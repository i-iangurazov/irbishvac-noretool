import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "exports", "retool-app");
const SRC_DIR = path.join(APP_DIR, "src");
const LIB_DIR = path.join(APP_DIR, "lib");
const APP_EXPORT_JSON_CANDIDATES = [
  path.join(ROOT, "IRBIS HVAC Dashboards Final Draft.json"),
  path.join(ROOT, "IRBIS%20HVAC%20Dashboards%20Final%20Draft.json"),
];
const WORKFLOW_FILES = [
  path.join(ROOT, "Final flow for tech and installers (2).json"),
  path.join(ROOT, "ST Metrics Refresh (3).json"),
];
const OUT_DIR = path.join(ROOT, "generated");
const OUT_FILE = path.join(OUT_DIR, "retool-inventory.json");

const RETOOL_QUERY_TAGS = [
  "RESTQuery",
  "SqlQueryUnified",
  "JavascriptQuery",
  "RetoolStorageQuery",
  "WorkflowRun",
  "connectResource",
];

const COMPONENT_TAGS = [
  "Button",
  "Chart",
  "Container",
  "Date",
  "Frame",
  "HTML",
  "Image",
  "Navigation",
  "Option",
  "Select",
  "Table",
  "Text",
  "Include",
];

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function resolveAppExportJson() {
  return APP_EXPORT_JSON_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ?? APP_EXPORT_JSON_CANDIDATES[0];
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function firstLine(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) || "";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseMapLike(node) {
  if (!Array.isArray(node)) {
    return node;
  }

  if (node.length === 2 && typeof node[0] === "string" && node[0].startsWith("^")) {
    return parseMapLike(node[1]);
  }

  const tag = typeof node[0] === "string" ? node[0] : null;

  if (tag === "^ ") {
    return pairArrayToObject(node.slice(1));
  }

  if (tag === "~#iM" || tag === "~#iOM") {
    return pairArrayToObject(Array.isArray(node[1]) ? node[1] : node.slice(1));
  }

  if (tag === "^A" || tag === "~#iL") {
    const arr = Array.isArray(node[1]) ? node[1] : node.slice(1);
    return arr.map(parseMapLike);
  }

  return node.map(parseMapLike);
}

function pairArrayToObject(pairs) {
  const result = {};

  for (let i = 0; i < pairs.length; i += 2) {
    const key = pairs[i];
    const rawValue = pairs[i + 1];
    if (typeof key !== "string") {
      continue;
    }
    result[key] = parseMapLike(rawValue);
  }

  return result;
}

function parseWorkflowTemplatePlugins(templateData) {
  const parsed = JSON.parse(templateData);
  const appTemplate = parseMapLike(parsed[1]?.[4] ?? parsed);
  const plugins = appTemplate.plugins ?? {};

  return Object.entries(plugins).map(([pluginId, pluginDef]) => {
    const normalized = parseMapLike(pluginDef);
    const pluginRoot = normalized?.v ?? normalized ?? {};
    const rawTemplate =
      pluginRoot.template ??
      pluginRoot["^1="] ??
      normalized?.template ??
      {};
    const template = Array.isArray(rawTemplate)
      ? pairArrayToObject(rawTemplate)
      : parseMapLike(rawTemplate);

    return {
      pluginId,
      id: pluginRoot.id ?? normalized?.id ?? pluginId,
      subtype: pluginRoot.subtype ?? pluginRoot["^19"] ?? normalized?.subtype ?? null,
      resourceName:
        pluginRoot.resourceName ??
        pluginRoot["^1;"] ??
        normalized?.resourceName ??
        template.resourceName ??
        null,
      resourceDisplayName:
        pluginRoot.resourceDisplayName ??
        pluginRoot["^1<"] ??
        normalized?.resourceDisplayName ??
        null,
      query: template.query ?? "",
      body: template.body ?? "",
      headers: template.headers ?? "",
      type: template.type ?? null,
      timeout: template.queryTimeout ?? null,
      runWhenPageLoads: template.runWhenPageLoads ?? false,
      transformer: template.transformer ?? "",
    };
  });
}

function stripTemplateExpressions(value) {
  return String(value || "")
    .replace(/\{\{[\s\S]*?\}\}/g, "{{template}}")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTablesFromSql(sql) {
  const ctes = new Set(
    [...sql.matchAll(/\bwith\s+([a-zA-Z0-9_."-]+)\s+as\b/gi)]
      .concat([...sql.matchAll(/,\s*([a-zA-Z0-9_."-]+)\s+as\b/gi)])
      .map((match) => match[1].replace(/"/g, ""))
  );
  const matches = [...sql.matchAll(/\b(?:from|into|update|join)\s+([a-zA-Z0-9_."-]+)/gi)];
  return unique(
    matches
      .map((match) => match[1])
      .map((name) => name.replace(/"/g, "").replace(/\.$/, ""))
      .filter((name) => !ctes.has(name))
      .filter((name) => !/^[A-Z_]+$/.test(name))
  );
}

function extractEnvCandidates(text) {
  const patterns = [
    { label: "ServiceTitan client ID", regex: /\bcid\.[a-z0-9]+\b/gi },
    { label: "ServiceTitan client secret", regex: /\bcs\d*\.[a-z0-9]+\b/gi },
    { label: "ServiceTitan app key", regex: /\bak1\.[a-z0-9]+\b/gi },
    {
      label: "ServiceTitan tenant ID",
      regex: /tenant\/(\d+)/gi,
      map: (match) => match[1],
    },
  ];

  const found = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.regex)) {
      found.push({
        label: pattern.label,
        value: pattern.map ? pattern.map(match) : match[0],
      });
    }
  }

  return found;
}

function extractServiceTitanReportDetails(text) {
  const matches = [
    ...text.matchAll(
      /https:\/\/api\.servicetitan\.io\/reporting\/v2\/tenant\/(\d+)\/report-category\/([^/\s"]+)\/reports\/(\d+)\/data/gi
    ),
  ];

  return matches.map((match) => ({
    tenantId: match[1],
    category: match[2],
    reportId: match[3],
    url: match[0],
  }));
}

function parseTagAttributes(tagSource) {
  const attrs = {};
  const attrRegex =
    /([A-Za-z0-9_:$-]+)=("([^"]*)"|\{([\s\S]*?)\})/g;
  let match;

  while ((match = attrRegex.exec(tagSource))) {
    const key = match[1];
    attrs[key] = match[3] ?? match[4] ?? "";
  }

  return attrs;
}

function extractIncludedFile(value) {
  const match = String(value || "").match(/include\("([^"]+)"/);
  return match?.[1] ?? null;
}

function parsePage(file) {
  const source = read(file);
  const screenTag = source.match(/<Screen\b([\s\S]*?)>/);
  const screenAttrs = parseTagAttributes(screenTag?.[1] ?? "");

  const queries = [];
  for (const tag of RETOOL_QUERY_TAGS) {
    const regex = new RegExp(`<${tag}\\b([\\s\\S]*?)(?:/>|>[\\s\\S]*?<\\/${tag}>)`, "g");
    let match;
    while ((match = regex.exec(source))) {
      const attrs = parseTagAttributes(match[1]);
      queries.push({
        tag,
        id: attrs.id ?? null,
        resourceName: attrs.resourceName ?? null,
        resourceDisplayName: attrs.resourceDisplayName ?? null,
        query: attrs.query ?? "",
        body: attrs.body ?? "",
        transformer: attrs.transformer ?? "",
        transformerSummary: firstLine(attrs.transformer),
        runWhenPageLoads: attrs.runWhenPageLoads ?? null,
        enableTransformer: attrs.enableTransformer ?? null,
        includedFile: extractIncludedFile(attrs.query),
      });
    }
  }

  const htmlWidgets = [];
  const htmlRegex = /<HTML\b([\s\S]*?)(?:\/>|>[\s\S]*?<\/HTML>)/g;
  let htmlMatch;
  while ((htmlMatch = htmlRegex.exec(source))) {
    const attrs = parseTagAttributes(htmlMatch[1]);
    htmlWidgets.push({
      id: attrs.id ?? null,
      htmlInclude: extractIncludedFile(attrs.html),
      cssInclude: extractIncludedFile(attrs.customCss),
    });
  }

  const components = [];
  for (const tag of COMPONENT_TAGS) {
    const regex = new RegExp(`<${tag}\\b([\\s\\S]*?)(?:/>|>)`, "g");
    let match;
    while ((match = regex.exec(source))) {
      const attrs = parseTagAttributes(match[1]);
      components.push({
        tag,
        id: attrs.id ?? null,
        label: attrs.label ?? attrs.text ?? attrs.value ?? null,
      });
    }
  }

  const buttons = components
    .filter((component) => component.tag === "Button")
    .map((button) => ({
      id: button.id,
      label: button.label,
    }));

  const dates = components
    .filter((component) => component.tag === "Date")
    .map((date) => ({
      id: date.id,
      defaultValue: date.label,
    }));

  return {
    file: path.relative(ROOT, file),
    id: screenAttrs.id ?? null,
    title: screenAttrs.title ?? null,
    urlSlug: screenAttrs.urlSlug ?? null,
    queries,
    htmlWidgets,
    components,
    buttons,
    dateInputs: dates,
    serviceTitanEndpoints: extractServiceTitanReportDetails(source),
    secrets: extractEnvCandidates(source),
  };
}

function parseWorkflow(file) {
  const raw = JSON.parse(read(file));
  const plugins = parseWorkflowTemplatePlugins(raw.templateData);
  const blocksByUuid = new Map(raw.blockData.map((block) => [block.uuid, block]));

  const execution = raw.blockData.map((block) => {
    const incoming = Array.isArray(block.incomingOnSuccessEdges)
      ? block.incomingOnSuccessEdges
      : [];
    const parents = incoming.map((uuid) => blocksByUuid.get(uuid)?.pluginId ?? uuid);

    return {
      pluginId: block.pluginId,
      blockType: block.blockType,
      editorType: block.editorType,
      resourceName: block.resourceName,
      waits: block.options?.durationTemplateString ?? null,
      dependsOn: parents,
    };
  });

  const workflowQueries = plugins
    .filter((plugin) => plugin.subtype && plugin.subtype !== "JavascriptQuery")
    .map((plugin) => ({
      pluginId: plugin.pluginId,
      subtype: plugin.subtype,
      resourceName: plugin.resourceName,
      type: plugin.type,
      query: plugin.query,
      body: plugin.body,
      transformerSummary: firstLine(plugin.transformer),
      serviceTitanEndpoints: extractServiceTitanReportDetails(`${plugin.query}\n${plugin.body}`),
      tables: extractTablesFromSql(plugin.query),
      secrets: extractEnvCandidates(`${plugin.query}\n${plugin.body}\n${plugin.headers}`),
    }));

  return {
    file: path.relative(ROOT, file),
    name: raw.name,
    timezone: raw.timezone,
    crontab: raw.crontab,
    isEnabled: raw.isEnabled,
    triggers: raw.triggerWebhooks,
    blocks: execution,
    queries: workflowQueries,
  };
}

function parseLibFiles() {
  const files = fs.readdirSync(LIB_DIR).map((file) => path.join(LIB_DIR, file));

  const sqlFiles = [];
  const jsFiles = [];
  const htmlFiles = [];
  const cssFiles = [];

  for (const file of files) {
    const relative = path.relative(ROOT, file);
    const content = read(file);
    if (file.endsWith(".sql")) {
      sqlFiles.push({
        file: relative,
        tables: extractTablesFromSql(content),
        summary: stripTemplateExpressions(firstLine(content)),
      });
    } else if (file.endsWith(".js")) {
      jsFiles.push({
        file: relative,
        summary: firstLine(content),
        serviceTitanEndpoints: extractServiceTitanReportDetails(content),
        secrets: extractEnvCandidates(content),
      });
    } else if (file.endsWith(".html")) {
      htmlFiles.push({
        file: relative,
        summary: stripTemplateExpressions(firstLine(content)),
      });
    } else if (file.endsWith(".css")) {
      cssFiles.push({
        file: relative,
        summary: stripTemplateExpressions(firstLine(content)),
      });
    }
  }

  return { sqlFiles, jsFiles, htmlFiles, cssFiles };
}

function buildInventory() {
  const appExportJson = resolveAppExportJson();
  const pageFiles = fs
    .readdirSync(SRC_DIR)
    .filter((file) => /^page\d+\.rsx$/.test(file))
    .sort((a, b) => a.localeCompare(b))
    .map((file) => path.join(SRC_DIR, file));

  const pages = pageFiles.map(parsePage);
  const workflows = WORKFLOW_FILES.map(parseWorkflow);
  const libs = parseLibFiles();
  const appJson = JSON.parse(read(appExportJson));

  const tables = unique([
    ...libs.sqlFiles.flatMap((file) => file.tables),
    ...workflows.flatMap((workflow) => workflow.queries.flatMap((query) => query.tables)),
  ]).sort();

  const endpoints = unique(
    [
      ...pages.flatMap((page) => page.serviceTitanEndpoints.map((endpoint) => endpoint.url)),
      ...workflows.flatMap((workflow) =>
        workflow.queries.flatMap((query) =>
          query.serviceTitanEndpoints.map((endpoint) => endpoint.url)
        )
      ),
      ...libs.jsFiles.flatMap((file) => file.serviceTitanEndpoints.map((endpoint) => endpoint.url)),
    ].filter(Boolean)
  ).sort();

  const secrets = unique(
    [
      ...pages.flatMap((page) => page.secrets.map((secret) => `${secret.label}: ${secret.value}`)),
      ...workflows.flatMap((workflow) =>
        workflow.queries.flatMap((query) =>
          query.secrets.map((secret) => `${secret.label}: ${secret.value}`)
        )
      ),
      ...libs.jsFiles.flatMap((file) =>
        file.secrets.map((secret) => `${secret.label}: ${secret.value}`)
      ),
    ]
  ).sort();

  return {
    generatedAt: new Date().toISOString(),
    appExportJson: path.relative(ROOT, appExportJson),
    appExportUuid: appJson.uuid,
    pages,
    workflows,
    libraries: libs,
    tables,
    endpoints,
    secrets,
  };
}

ensureDir(OUT_DIR);
const inventory = buildInventory();
fs.writeFileSync(OUT_FILE, `${JSON.stringify(inventory, null, 2)}\n`);
console.log(`Wrote ${path.relative(ROOT, OUT_FILE)}`);
