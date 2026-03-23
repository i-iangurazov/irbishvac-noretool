<Container
  id="container41"
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
      id="containerTitle24"
      value="#### Container title"
      verticalAlign="center"
    />
  </Header>
  <View id="00030" viewKey="View 1">
    <Text id="text68" value="## CALLS" verticalAlign="center" />
    <ProgressCircle
      id="progressCircle1"
      horizontalAlign="center"
      style={{ fill: "#007848", track: "#d8ffee" }}
      value="{{ getBookingRateDB.data.progress?.value }}"
    />
    <Text
      id="text21"
      horizontalAlign="center"
      value="{{ getBookingRateDB.data.kpis?.leads }}
Leads"
      verticalAlign="center"
    />
    <Text
      id="text22"
      horizontalAlign="center"
      value="{{ getBookingRateDB.data.kpis?.booked }}
Booked"
      verticalAlign="center"
    />
  </View>
</Container>
