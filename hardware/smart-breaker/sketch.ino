#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <math.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

Adafruit_SSD1306 energyOLED(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Adafruit_SSD1306 circuitOLED(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

const int LOAD_DIAL = 34;
const int BATTERY_SLIDER = 35;
const int RESET_BUTTON = 32;
const int VACATION_SWITCH = 33;

const int GREEN_LED = 25;
const int RED_LED = 26;
const int BUZZER = 27;

const int RELAY_AC = 13;
const int RELAY_WATER = 14;
const int RELAY_OUTLETS = 16;
const int RELAY_FRIDGE = 17;
const int RELAY_WIFI = 18;
const int RELAY_LIGHTS = 19;

const float SAFE_AMPS = 15.0;
const float BATTERY_CAPACITY_KWH = 10.0;
const float BATTERY_RESERVE_KWH = 2.0;   // Keep 20% in reserve
const float MAX_BATTERY_DISCHARGE_W = 1800.0;
const float MAX_GRID_CHARGE_W = 1200.0;
const float MAX_SOLAR_CHARGE_W = 1500.0;
const float SOLAR_MAX_W = 2500.0;
const float VIRTUAL_HOURS_PER_SECOND = 0.5;

float batteryKwh = 0;
float gridCost = 0;

bool breakerTripped = false;
bool lastResetState = HIGH;
bool circuitOLEDReady = false;

unsigned long lastTime = 0;
unsigned long simStart = 0;

float smaller(float a, float b) {
  return a < b ? a : b;
}

void setRelay(int relayPin, bool on) {
  // Wokwi relay module is active when IN is LOW.
  digitalWrite(relayPin, on ? LOW : HIGH);
}

float batteryChargeLimit(float requestedWatts, float hoursPassed) {
  if (hoursPassed <= 0.0001) return 0;

  float openSpaceKwh = BATTERY_CAPACITY_KWH - batteryKwh;
  float maxPossibleWatts = openSpaceKwh * 1000.0 / hoursPassed;

  return smaller(requestedWatts, maxPossibleWatts);
}

void setup() {
  Serial.begin(115200);

  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  pinMode(RESET_BUTTON, INPUT_PULLUP);
  pinMode(VACATION_SWITCH, INPUT_PULLUP);

  pinMode(RELAY_AC, OUTPUT);
  pinMode(RELAY_WATER, OUTPUT);
  pinMode(RELAY_OUTLETS, OUTPUT);
  pinMode(RELAY_FRIDGE, OUTPUT);
  pinMode(RELAY_WIFI, OUTPUT);
  pinMode(RELAY_LIGHTS, OUTPUT);

  setRelay(RELAY_AC, false);
  setRelay(RELAY_WATER, false);
  setRelay(RELAY_OUTLETS, false);
  setRelay(RELAY_FRIDGE, false);
  setRelay(RELAY_WIFI, false);
  setRelay(RELAY_LIGHTS, false);

  Wire.begin(21, 22);

  bool energyOLEDReady =
    energyOLED.begin(SSD1306_SWITCHCAPVCC, 0x3C, false, false);

  circuitOLEDReady =
    circuitOLED.begin(SSD1306_SWITCHCAPVCC, 0x3D, false, false);

  if (!energyOLEDReady) {
    Serial.println("Energy OLED missing. Check 0x3C wiring.");
    while (true);
  }

  if (!circuitOLEDReady) {
    Serial.println("Circuit OLED missing. Energy OLED still works.");
  }

  // Slider chooses beginning battery charge.
  batteryKwh =
    analogRead(BATTERY_SLIDER) * BATTERY_CAPACITY_KWH / 4095.0;

  simStart = millis();
  lastTime = simStart;
}

void loop() {
  unsigned long now = millis();

  float hoursPassed =
    (now - lastTime) * VIRTUAL_HOURS_PER_SECOND / 1000.0;

  lastTime = now;

  // Demo begins at 4 AM: cheap-grid charging period.
  float timeOfDay =
    4.0 + (now - simStart) * VIRTUAL_HOURS_PER_SECOND / 1000.0;

  while (timeOfDay >= 24.0) {
    timeOfDay -= 24.0;
  }

  int hour = (int)timeOfDay;
  int minute = (int)((timeOfDay - hour) * 60);

  bool cheapGrid = (timeOfDay < 6.0 || timeOfDay >= 22.0);

  // Solar is available from 6 AM to 6 PM.
  float solarWatts = 0;

  if (timeOfDay >= 6.0 && timeOfDay <= 18.0) {
    float sunAngle = (timeOfDay - 6.0) * PI / 12.0;
    solarWatts = sin(sunAngle) * SOLAR_MAX_W;
  }

  int solarPercent = (int)(solarWatts * 100.0 / SOLAR_MAX_W);

  bool vacationMode = digitalRead(VACATION_SWITCH) == LOW;

  // Virtual circuit loads
  bool wantsAC = !vacationMode;
  bool wantsWater = !vacationMode;
  bool wantsOutlets = !vacationMode;

  const float AC_LOAD = 500;
  const float WATER_LOAD = 500;
  const float OUTLET_LOAD = 250;
  const float FRIDGE_LOAD = 150;
  const float WIFI_LOAD = 80;
  const float LIGHT_LOAD = 60;

  // Load dial adds a temporary appliance load to test the breaker.
  float extraLoad =
    analogRead(LOAD_DIAL) * 1800.0 / 4095.0;

  float requestedLoadWatts =
    (wantsAC ? AC_LOAD : 0) +
    (wantsWater ? WATER_LOAD : 0) +
    (wantsOutlets ? OUTLET_LOAD : 0) +
    FRIDGE_LOAD + WIFI_LOAD + LIGHT_LOAD + extraLoad;

  float requestedAmps = requestedLoadWatts / 120.0;

  if (requestedAmps > SAFE_AMPS) {
    breakerTripped = true;
  }

  bool resetState = digitalRead(RESET_BUTTON);

  if (lastResetState == HIGH && resetState == LOW) {
    if (breakerTripped && requestedAmps <= SAFE_AMPS) {
      breakerTripped = false;
    }
    delay(150);
  }

  lastResetState = resetState;

  float activeLoadWatts = breakerTripped ? 0 : requestedLoadWatts;

  // First, solar supplies as much of the house as possible.
  float solarToLoad = smaller(solarWatts, activeLoadWatts);
  float remainingLoadWatts = activeLoadWatts - solarToLoad;

  float solarChargeWatts = 0;
  float gridChargeWatts = 0;
  float batteryToLoadWatts = 0;
  float gridToLoadWatts = 0;

  const char* source = "SOLAR";
  const char* note = "PANEL POWER";

  if (breakerTripped) {
    source = "TRIPPED";

    // The house is safely disconnected, but storage can recharge.
    if (cheapGrid) {
      gridChargeWatts =
        batteryChargeLimit(MAX_GRID_CHARGE_W, hoursPassed);

      note = "SAFE GRID CHARGE";
    } else if (solarWatts > 0) {
      solarChargeWatts =
        batteryChargeLimit(smaller(solarWatts, MAX_SOLAR_CHARGE_W),
                           hoursPassed);

      note = "SAFE SOLAR CHARGE";
    } else {
      note = "RESET WHEN SAFE";
    }

  } else if (cheapGrid) {
    // Overnight grid supplies home AND charges the battery cheaply.
    source = "CHEAP GRID";
    gridToLoadWatts = remainingLoadWatts;
    gridChargeWatts =
      batteryChargeLimit(MAX_GRID_CHARGE_W, hoursPassed);

    note = "CHARGING BATTERY";

  } else {
    // Daytime excess solar charges the same battery.
    if (solarWatts > activeLoadWatts) {
      solarChargeWatts =
        batteryChargeLimit(
          smaller(solarWatts - activeLoadWatts,
                  MAX_SOLAR_CHARGE_W),
          hoursPassed
        );
    }

    // During peak hours, battery covers missing solar power.
    if (remainingLoadWatts > 0 &&
        batteryKwh > BATTERY_RESERVE_KWH) {

      float availableBatteryWatts =
        (batteryKwh - BATTERY_RESERVE_KWH) *
        1000.0 / hoursPassed;

      availableBatteryWatts =
        smaller(availableBatteryWatts,
                MAX_BATTERY_DISCHARGE_W);

      batteryToLoadWatts =
        smaller(remainingLoadWatts,
                availableBatteryWatts);

      remainingLoadWatts -= batteryToLoadWatts;
    }

    // Normal grid only fills power that solar and battery cannot cover.
    gridToLoadWatts = remainingLoadWatts;

    if (solarToLoad >= activeLoadWatts &&
        solarChargeWatts > 0) {
      source = "SOLAR";
      note = "SOLAR CHARGING";

    } else if (solarToLoad >= activeLoadWatts) {
      source = "SOLAR";
      note = "PANEL POWER";

    } else if (solarToLoad > 0 &&
               batteryToLoadWatts > 0 &&
               gridToLoadWatts == 0) {
      source = "SOLAR+BATT";
      note = "STORED POWER";

    } else if (batteryToLoadWatts > 0 &&
               gridToLoadWatts == 0) {
      source = "BATTERY";
      note = "STORED POWER";

    } else if (gridToLoadWatts > 0) {
      source = "GRID";
      note = "GRID FALLBACK";
    }
  }

  // Update one shared battery.
  batteryKwh +=
    (solarChargeWatts + gridChargeWatts - batteryToLoadWatts) *
    hoursPassed / 1000.0;

  if (batteryKwh < 0) batteryKwh = 0;
  if (batteryKwh > BATTERY_CAPACITY_KWH) {
    batteryKwh = BATTERY_CAPACITY_KWH;
  }

  float gridRate = cheapGrid ? 0.08 : 0.22;

  gridCost +=
    (gridToLoadWatts + gridChargeWatts) *
    hoursPassed / 1000.0 * gridRate;

  int batteryPercent =
    (int)(batteryKwh * 100.0 / BATTERY_CAPACITY_KWH);

  // Circuit status
  bool acOn = wantsAC && !breakerTripped;
  bool waterOn = wantsWater && !breakerTripped;
  bool outletsOn = wantsOutlets && !breakerTripped;

  bool fridgeOn = !breakerTripped;
  bool wifiOn = !breakerTripped;
  bool lightsOn = !breakerTripped;

  setRelay(RELAY_AC, acOn);
  setRelay(RELAY_WATER, waterOn);
  setRelay(RELAY_OUTLETS, outletsOn);
  setRelay(RELAY_FRIDGE, fridgeOn);
  setRelay(RELAY_WIFI, wifiOn);
  setRelay(RELAY_LIGHTS, lightsOn);

  digitalWrite(GREEN_LED, breakerTripped ? LOW : HIGH);
  digitalWrite(RED_LED, breakerTripped ? HIGH : LOW);

  if (breakerTripped) {
    tone(BUZZER, 1000);
  } else {
    noTone(BUZZER);
  }

  // OLED 1: Energy dashboard
  energyOLED.clearDisplay();
  energyOLED.setTextColor(SSD1306_WHITE);
  energyOLED.setTextSize(1);

  energyOLED.setCursor(0, 0);
  energyOLED.print("WATTCH ENERGY");

  energyOLED.setCursor(0, 9);
  energyOLED.print("Source: ");
  energyOLED.print(source);

  energyOLED.setCursor(0, 18);
  if (hour < 10) energyOLED.print("0");
  energyOLED.print(hour);
  energyOLED.print(":");
  if (minute < 10) energyOLED.print("0");
  energyOLED.print(minute);
  energyOLED.print(cheapGrid ? " CHEAP" : " PEAK");

  energyOLED.setCursor(0, 27);
  energyOLED.print("Solar: ");
  energyOLED.print(solarPercent);
  energyOLED.print("%");

  energyOLED.setCursor(0, 36);
  energyOLED.print("Battery: ");
  energyOLED.print(batteryPercent);
  energyOLED.print("%");

  energyOLED.setCursor(0, 45);
  energyOLED.print("Load: ");
  energyOLED.print(activeLoadWatts, 0);
  energyOLED.print("W");

  energyOLED.setCursor(0, 54);
  energyOLED.print(note);

  energyOLED.display();

  // OLED 2: Circuit status dashboard
  if (circuitOLEDReady) {
    circuitOLED.clearDisplay();
    circuitOLED.setTextColor(SSD1306_WHITE);
    circuitOLED.setTextSize(1);

    circuitOLED.setCursor(0, 0);
    circuitOLED.print("VACATION: ");
    circuitOLED.print(vacationMode ? "ON" : "OFF");

    circuitOLED.setCursor(0, 8);
    circuitOLED.print("AC/Eco: ");
    circuitOLED.print(acOn ? "ON" : "OFF");

    circuitOLED.setCursor(0, 16);
    circuitOLED.print("Water: ");
    circuitOLED.print(waterOn ? "ON" : "OFF");

    circuitOLED.setCursor(0, 24);
    circuitOLED.print("Outlets: ");
    circuitOLED.print(outletsOn ? "ON" : "OFF");

    circuitOLED.setCursor(0, 32);
    circuitOLED.print("Fridge: ");
    circuitOLED.print(fridgeOn ? "ON" : "OFF");

    circuitOLED.setCursor(0, 40);
    circuitOLED.print("WiFi/Sec: ");
    circuitOLED.print(wifiOn ? "ON" : "OFF");

    circuitOLED.setCursor(0, 48);
    circuitOLED.print("Lights: ");
    circuitOLED.print(lightsOn ? "ON" : "OFF");

    circuitOLED.setCursor(0, 56);
    circuitOLED.print("Breaker: ");
    circuitOLED.print(breakerTripped ? "TRIPPED" : "SAFE");

    circuitOLED.display();
  }

  delay(200);
}