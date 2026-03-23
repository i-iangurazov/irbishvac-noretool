<DrawerFrame
  id="drawerFrame1"
  footerPadding="8px 12px"
  headerPadding="8px 12px"
  hidden={true}
  hideOnEscape={true}
  isHiddenOnMobile={true}
  overlayInteraction={true}
  padding="8px 12px"
  showHeader={true}
  showOverlay={true}
  style={{ map: { background: "#ffffff" } }}
  width="medium"
>
  <Header>
    <Text id="drawerTitle1" value="### Goal Insert" verticalAlign="center" />
    <Button
      id="drawerCloseButton1"
      ariaLabel="Close"
      horizontalAlign="right"
      iconBefore="bold/interface-delete-1"
      style={{ map: { border: "transparent" } }}
      styleVariant="outline"
    >
      <Event
        id="7381e5e2"
        event="click"
        method="setHidden"
        params={{ map: { hidden: true } }}
        pluginId="drawerFrame1"
        type="widget"
        waitMs="0"
        waitType="debounce"
      />
    </Button>
  </Header>
  <Body>
    <Select
      id="select1"
      emptyMessage="No options"
      itemMode="static"
      label="Month"
      labelPosition="top"
      overlayMaxHeight={375}
      placeholder="Select an option"
      showSelectionIndicator={true}
    >
      <Option id="711b6" disabled={false} hidden={false} value="January" />
      <Option id="664e2" disabled={false} hidden={false} value="February" />
      <Option id="41ec4" disabled={false} hidden={false} value="March" />
      <Option id="478a7" disabled={false} hidden={false} value="April" />
      <Option id="3a2d7" disabled={false} hidden={false} value="May" />
      <Option id="0e472" disabled={false} hidden={false} value="June" />
      <Option id="30207" disabled={false} hidden={false} value="July" />
      <Option id="8e3a0" disabled={false} hidden={false} value="August" />
      <Option id="c626a" disabled={false} hidden={false} value="September" />
      <Option id="ea038" disabled={false} hidden={false} value="October" />
      <Option id="903e8" disabled={false} hidden={false} value="November" />
      <Option id="49d92" disabled={false} hidden={false} value="December" />
    </Select>
    <NumberInput
      id="numberInput1"
      currency="USD"
      inputValue={0}
      label="Goal"
      labelPosition="top"
      placeholder="Enter value"
      showSeparators={true}
      showStepper={true}
      value={0}
    />
    <Button
      id="button27"
      loading=""
      style={{ map: { background: "#00363e" } }}
      text="Submit"
    >
      <Event
        id="64965bc8"
        enabled="{{ !!select1.value &&!!numberInput1.value }}"
        event="click"
        method="trigger"
        params={{}}
        pluginId="goalTrackerDB"
        type="datasource"
        waitMs="1000"
        waitType="debounce"
      />
      <Event
        id="089bca4d"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getTrending"
        type="datasource"
        waitMs="2000"
        waitType="debounce"
      />
      <Event
        id="143806c3"
        event="click"
        method="trigger"
        params={{}}
        pluginId="getGoalTrackerDB"
        type="datasource"
        waitMs="3000"
        waitType="debounce"
      />
      <Event
        id="85e4c048"
        event="click"
        method="trigger"
        params={{}}
        pluginId="monthMap"
        type="datasource"
        waitMs="0"
        waitType="debounce"
      />
    </Button>
  </Body>
</DrawerFrame>
