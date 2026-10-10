import streamlit as st

from data.mock_data import DEMO_SCENARIO


def get_battery_plan(
    price_per_kwh,
    battery_percent,
    reserve_percent,
    battery_capacity_mwh,
    max_output_mw,
    building_demand_mw,
    grid_event_active,
    manual_override,
):
    low_price = 0.11
    high_price = 0.20

    usable_energy_mwh = battery_capacity_mwh * max(
        0, (battery_percent - reserve_percent) / 100
    )
    backup_hours = usable_energy_mwh / max_output_mw if max_output_mw else 0

    if manual_override == "Charge battery":
        action = "CHARGE"
        message = "Manual override is charging the battery from the grid."
    elif manual_override == "Use battery":
        action = "DISCHARGE"
        message = "Manual override is using stored battery power."
    elif manual_override == "Hold battery":
        action = "HOLD"
        message = "Manual override is preserving the battery."
    elif grid_event_active and battery_percent > reserve_percent:
        action = "DISCHARGE"
        message = "Grid Event Mode is active. GridPilot is reducing demand while protecting emergency backup."
    elif price_per_kwh <= low_price and battery_percent < 100:
        action = "CHARGE"
        message = "Electricity is cheap right now, so GridPilot recommends charging."
    elif price_per_kwh >= high_price and battery_percent > reserve_percent:
        action = "DISCHARGE"
        message = "Electricity is expensive right now, so GridPilot recommends using battery power."
    else:
        action = "HOLD"
        message = "GridPilot recommends holding battery power for a future peak or outage."

    if action == "DISCHARGE" and battery_percent <= reserve_percent:
        action = "HOLD"
        message = "The battery is at its emergency reserve, so GridPilot will preserve the remaining charge."

    power_used_mw = min(max_output_mw, building_demand_mw) if action == "DISCHARGE" else 0
    hourly_savings = power_used_mw * 1000 * max(0, price_per_kwh - low_price)

    return {
        "action": action,
        "message": message,
        "usable_energy_mwh": usable_energy_mwh,
        "backup_hours": backup_hours,
        "power_used_mw": power_used_mw,
        "hourly_savings": hourly_savings,
    }


def render_battery_page():
    st.header("Battery Autopilot")

    st.caption(
        "Demo simulation only — GridPilot recommends actions but does not control a real battery. "
        f"Scenario: {DEMO_SCENARIO['time']} during a {DEMO_SCENARIO['weather'].lower()}."
    )

    left, right = st.columns(2)

    with left:
        battery_percent = st.slider(
            "Current battery level (%)", 0, 100, DEMO_SCENARIO["battery_percent"]
        )
        reserve_percent = st.slider(
            "Emergency backup reserve (%)",
            10,
            80,
            DEMO_SCENARIO["emergency_reserve_percent"],
        )
        battery_capacity_mwh = st.slider(
            "Battery capacity (MWh)", 1, 20, DEMO_SCENARIO["battery_capacity_mwh"]
        )

    with right:
        price_per_kwh = st.slider(
            "Current electricity price ($/kWh)",
            0.05,
            0.50,
            DEMO_SCENARIO["electricity_price"],
        )
        building_demand_mw = st.slider(
            "Building demand (MW)", 1, 15, DEMO_SCENARIO["building_demand_mw"]
        )
        max_output_mw = st.slider(
            "Maximum battery output (MW)", 1, 5, DEMO_SCENARIO["max_output_mw"]
        )

    st.divider()

    grid_event_active = st.toggle(
        f"Grid Event Mode: {DEMO_SCENARIO['weather']} and high grid demand",
        value=DEMO_SCENARIO["grid_event_active"],
    )

    manual_override = st.selectbox(
        "Manual override",
        ["Automatic", "Charge battery", "Use battery", "Hold battery"],
    )

    override_value = None if manual_override == "Automatic" else manual_override

    plan = get_battery_plan(
        price_per_kwh,
        battery_percent,
        reserve_percent,
        battery_capacity_mwh,
        max_output_mw,
        building_demand_mw,
        grid_event_active,
        override_value,
    )

    metric_1, metric_2, metric_3, metric_4 = st.columns(4)
    metric_1.metric("Battery level", f"{battery_percent}%")
    metric_2.metric("Emergency reserve", f"{reserve_percent}%")
    metric_3.metric("Backup time", f"{plan['backup_hours']:.1f} hours")
    metric_4.metric("Estimated savings", f"${plan['hourly_savings']:,.0f}/hour")

    st.progress(battery_percent / 100)

    if plan["action"] == "CHARGE":
        st.success(f"Recommended action: {plan['action']}")
    elif plan["action"] == "DISCHARGE":
        st.warning(f"Recommended action: {plan['action']}")
    else:
        st.info(f"Recommended action: {plan['action']}")

    st.write(plan["message"])

    if plan["action"] == "DISCHARGE":
        st.write(
            f"GridPilot will supply **{plan['power_used_mw']} MW** from the battery, "
            f"reducing the building's grid demand during this peak period."
        )

    st.subheader("AI Explanation")
    st.write(
        f"At ${price_per_kwh:.2f}/kWh, electricity is "
        f"{'expensive' if price_per_kwh >= 0.20 else 'cheap' if price_per_kwh <= 0.11 else 'moderately priced'}. "
        f"GridPilot keeps at least {reserve_percent}% stored for emergency backup."
    )


if __name__ == "__main__":
    st.set_page_config(page_title="Wattch Battery Autopilot", layout="wide")
    render_battery_page()