<App>
  <Include src="./src/page1.rsx" />
  <Include src="./src/page2.rsx" />
  <Include src="./src/page3.rsx" />
  <AppStyles id="$appStyles" css={include("./lib/$appStyles.css", "string")} />
  <CustomAppTheme
    id="$appTheme"
    _migrated={true}
    automatic={[
      "#fde68a",
      "#eecff3",
      "#a7f3d0",
      "#bfdbfe",
      "#c7d2fe",
      "#fecaca",
      "#fcd6bb",
    ]}
    borderRadius="4px"
    canvas="#ffffff"
    danger="#dc2626"
    defaultFont={{ size: "12px", fontWeight: "400" }}
    defaultFontId="f101545a"
    fontIds={["f101545a"]}
    fontMap={{
      map: {
        f101545a: {
          name: "Montserrat",
          source:
            "https://fonts.googleapis.com/css?family=Montserrat:100,200,300,400,500,600,700,800,900",
          fontWeights: [
            "100",
            "200",
            "300",
            "400",
            "500",
            "600",
            "700",
            "800",
            "900",
          ],
        },
      },
    }}
    h1Font={{ size: "36px", fontWeight: "700" }}
    h2Font={{ size: "28px", fontWeight: "700" }}
    h3Font={{ size: "24px", fontWeight: "700" }}
    h4Font={{ size: "18px", fontWeight: "700" }}
    h5Font={{ size: "16px", fontWeight: "700" }}
    h6Font={{ size: "14px", fontWeight: "700" }}
    highlight="#fde68a"
    info="#3170f9"
    labelEmphasizedFont={{ size: "12px", fontWeight: "600" }}
    labelFont={{ size: "12px", fontWeight: "500" }}
    primary="#3170f9"
    secondary=""
    success="#059669"
    surfacePrimary="#00363e"
    surfacePrimaryBorder=""
    surfaceSecondary="#002c3f"
    surfaceSecondaryBorder=""
    tertiary=""
    textDark="#0d0d0d"
    textLight="#ffffff"
    warning="#cd6f00"
  />
  <Include src="./src/page4.rsx" />
  <Include src="./src/page6.rsx" />
  <Include src="./src/page7.rsx" />
  <Include src="./src/page8.rsx" />
  <Include src="./src/page9.rsx" />
</App>
