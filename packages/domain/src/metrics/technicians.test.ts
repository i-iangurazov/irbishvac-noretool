import { describe, expect, it } from "vitest";
import {
  buildTechnicianDashboard,
  filterTechnicianDashboardByDepartment
} from "./technicians";

describe("buildTechnicianDashboard", () => {
  it("retains real jobs, revenue, membership opportunities and negative sales for staff omitted by the compact scorecard", () => {
    const complete=(fields:string[],data:unknown[][])=>({fields:fields.map(name=>({name})),data,hasMore:false,totalCount:data.length,personnelCoverage:{complete:true,businessUnitIds:null}});
    const primary=complete(["Name","CompletedRevenue","CompletedJobs","TotalSales","SalesOpportunity","ClosedOpportunities","MembershipsSold"],[["Existing",100,2,250,3,1,0]]);
    const operations=complete(["Name","TechnicianId","CompletedRevenue","CompletedJobs","TotalSales","MembershipOpportunities","MembershipsSold","TotalLeadSales"],[["Existing",1,100,2,250,2,0,0],["Plumber",2,1798,4,-99,4,0,0],["Zero revenue tech",3,0,3,0,3,0,0]]);
    const result=buildTechnicianDashboard({...primary,operationsSupplement:operations});
    expect(result.rows.find(row=>row.technicianId==="2")).toMatchObject({completedRevenue:1798,completedJobs:4,totalSales:-99,membershipOpportunities:4});
    expect(result.rows.find(row=>row.technicianId==="3")).toMatchObject({completedJobs:3,totalSales:0,membershipOpportunities:3});
    expect(result.rows.find(row=>row.technicianId==="1")).toMatchObject({salesOpportunity:3,closedOpportunities:1,totalSales:250});
    expect(buildTechnicianDashboard({...primary,operationsSupplement:{...operations,hasMore:true}}).rows).toHaveLength(1);
  });
  it("preserves weighted totals and ranking", () => {
    const result = buildTechnicianDashboard({
      fields: [
        { name: "Name" },
        { name: "TechnicianBusinessUnit" },
        { name: "CompletedRevenue" },
        { name: "TotalLeadSales" },
        { name: "SalesOpportunity" },
        { name: "ClosedOpportunities" },
        { name: "OpportunityAverageSale" },
        { name: "MembershipOpportunities" },
        { name: "MembershipsSold" },
        { name: "CloseRate" }
      ],
      data: [
        ["Alice", "Service", 1000, 200, 10, 5, 500, 4, 2, 0.5],
        ["Bob", "Service", 500, 50, 5, 2, 250, 2, 1, 0.4]
      ]
    });

    expect(result.rowsRanked[0]?.name).toBe("Alice");
    expect(result.totals.totalInfluencedRevenue).toBe(1750);
    expect(result.totals.avgCloseRate).toBe("0.467");
    expect(result.totals.avgMembershipConv).toBe("0.500");
  });

  it("derives close rate from opportunity counts when the reported rate is stale", () => {
    const result = buildTechnicianDashboard({
      fields: [
        { name: "Name" },
        { name: "SalesOpportunity" },
        { name: "ClosedOpportunities" },
        { name: "CloseRate" },
      ],
      data: [["Ivan Avila", 29, 19, 0.56]],
    });

    expect(result.rows[0]?.closeRate).toBeCloseTo(19 / 29, 10);
  });

  it("separates service, plumbing, and electrical technicians from ST position or business unit", () => {
    const result = buildTechnicianDashboard({
      fields: [
        { name: "Name" },
        { name: "TechnicianBusinessUnit" },
        { name: "Position" },
        { name: "CompletedRevenue" },
        { name: "TotalLeadSales" },
        { name: "SalesOpportunity" },
        { name: "ClosedOpportunities" },
        { name: "OpportunityAverageSale" },
        { name: "MembershipOpportunities" },
        { name: "MembershipsSold" }
      ],
      data: [
        ["HVAC Tech", "HVAC - Service", "", 1000, 100, 10, 5, 500, 4, 2],
        ["Plumber", "Plumbing - Service", "", 2000, 200, 20, 10, 700, 6, 3],
        [
          "Electrician",
          "HVAC - Service",
          "Electrical Service Technicians",
          3000,
          300,
          30,
          15,
          900,
          8,
          4
        ],
        [
          "Advisor Position",
          "Plumbing - Service",
          "HVAC Comfort Advisors",
          4000,
          400,
          40,
          20,
          1100,
          10,
          5
        ]
      ]
    });

    expect(filterTechnicianDashboardByDepartment(result, "hvac-service").rowsRanked).toHaveLength(1);
    expect(filterTechnicianDashboardByDepartment(result, "plumbing-service").rowsRanked).toHaveLength(1);
    expect(filterTechnicianDashboardByDepartment(result, "plumbing-service").rowsRanked[0]?.name).toBe("Plumber");
    expect(filterTechnicianDashboardByDepartment(result, "electrical-service").rowsRanked[0]?.name).toBe(
      "Electrician",
    );
    expect(filterTechnicianDashboardByDepartment(result, "hvac-comfort-advisor").rowsRanked[0]?.name).toBe(
      "Advisor Position",
    );
  });
});
