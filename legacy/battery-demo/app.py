import streamlit as st

st.set_page_config(page_title="Wattch", page_icon="⚡", layout="wide")

st.title("⚡ Wattch")
st.subheader("Your home's utility intelligence dashboard")

st.metric("Estimated utilities this month", "$284", "+$31 vs. last month")
st.metric("Electricity use today", "32.4 kWh", "+12%")
st.metric("Storm readiness", "Good", "Battery 82%")

st.divider()

st.header("AI Insights")
st.warning("Water use is 38% higher than normal. Check for a possible leak or irrigation issue.")
st.info("Heatwave expected this week. Your AC costs may increase by about $18.")
st.success("Best EV charging window: 11 PM - 6 AM.")

st.header("Utility Costs")

st.bar_chart({
    "Utility": ["Electricity", "Water", "Gas", "Solid Waste"],
    "Monthly Cost": [145, 62, 48, 29]
})

st.header("Storm Reserve")

st.write("A storm is forecast in 36 hours. Wattch recommends charging your home battery to 90%.")
if st.button("Enable Storm Reserve"):
    st.success("Storm Reserve enabled. Your battery target is now 90%.")