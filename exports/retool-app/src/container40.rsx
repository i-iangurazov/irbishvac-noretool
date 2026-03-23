<Container
  id="container40"
  footerPadding="4px 12px"
  headerPadding="4px 12px"
  padding="12px"
  showBody={true}
  showBorder={false}
  style={{
    background: "#ffffff",
    boxShadow: "0 6px 22px rgba(16,24,40,0.08)",
    borderRadius: "12px",
  }}
>
  <Header>
    <Text
      id="containerTitle23"
      value="#### Container title"
      verticalAlign="center"
    />
  </Header>
  <View id="00030" viewKey="View 1">
    <Text
      id="text17"
      value="#### COMPANY REVENUE MONTHLY PACE"
      verticalAlign="center"
    />
    <Text
      id="text19"
      horizontalAlign="center"
      style={{ background: "rgba(255, 98, 0, 1)", color: "canvas" }}
      value={'#### {{ getRevenueMonthlyPaceDB.data.formatted || "$0M" }}'}
      verticalAlign="center"
    />
    <Text
      id="text18"
      value="#### COMPANY SALES MONTHLY PACE"
      verticalAlign="center"
    />
    <Text
      id="text20"
      horizontalAlign="center"
      style={{ background: "rgba(255, 98, 0, 1)", color: "canvas" }}
      value={
        '#### {{ getSalesMonthlyPaceDB.data.formatted.paceCompact || "$0M" }}'
      }
      verticalAlign="center"
    />
  </View>
</Container>
