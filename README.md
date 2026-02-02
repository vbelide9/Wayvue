# Wayvue | Trip Intelligence

Wayvue is an advanced trip intelligence dashboard designed to enhance your travel experience. It combines real-time weather, routing data, and AI-driven insights to calculate trip safety and suggest optimal departure times.

## 🚀 Key Features

### 🧠 AI Trip Intelligence
-   **Trip Confidence Score**: A 0-100% safety rating based on weather, wind, traffic, and road conditions.
    -   *dynamic penalties* for rain, snow, high winds, and congestion.
    -   *Snow/Ice Detection*: Severe penalties (-40 points) applied when winter conditions are detected.
-   **Smart Departure Planner**: Predictive analysis showing the "Best Time to Leave" over the next 3 hours to avoid storms or traffic.
-   **Natural Language Summary**: A concise, friendly assistant that summarizes your entire route.

### 🗺️ Interactive Mapping
-   **Smart Route Visualization**: Real-time route rendering with color-coded segments for traffic.
-   **Weather Overlays**: Live weather data (Sun, Rain, Snow, Wind) mapped directly to route segments.
-   **Road Conditions**: Alerts for traffic jams, accidents, and weather hazards.

### 📍 Points of Interest
-   **Suggested Stops**: Intelligently recommends Gas, Food, EV Charging, and Scenic spots along your path using OpenStreetMap.

### 💻 Modern UI
-   **Responsive Dashboard**: Resizable panels for map, AI insights, and weather timeline.
-   **Wind & Fuel Indicators**: Visual cues for wind direction/speed and fuel cost estimation.

## 🛠️ Tech Stack & Services

**Client**: React 19, Vite, Tailwind CSS 4, Lucide React, Leaflet  
**Server**: Node.js, Express

**Integrated Services (Free / Demo Tier)**:
-   **Routing**: [OSRM](http://project-osrm.org/) (Open Source Routing Machine)
-   **Weather**: [Open-Meteo](https://open-mteo.com/) (Hourly forecast & history)
-   **Geocoding**: [ArcGIS REST API](https://developers.arcgis.com/rest/geocode/api-reference/overview-world-geocoding-service.htm)
-   **Places**: [Overpass API (OpenStreetMap)](https://wiki.openstreetmap.org/wiki/Overpass_API)
-   **Traffic Cameras**: 511NY (Simulated/Fallback support included)

## 📦 Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/vbelide9/Wayvue.git
    cd Wayvue
    ```

2.  **Install Server Dependencies**
    ```bash
    cd server
    npm install
    ```

3.  **Install Client Dependencies**
    ```bash
    cd ../client
    npm install
    ```

4.  **Environment Setup**
    -   The app is pre-configured to work with free public APIs out of the box.
    -   Create a `.env` file in `server/` if you wish to override defaults (e.g., `PORT=3001`).

## 🏃‍♂️ Usage

1.  **Start the Backend**
    ```bash
    cd server
    node index.js
    ```
    *Runs on http://localhost:3001*

2.  **Start the Frontend**
    ```bash
    cd client
    npm run dev
    ```
    *Runs on http://localhost:5173*

3.  **Explore**: Enter a "Start" and "End" location (e.g., "New York, NY" to "Boston, MA") and click **Calculate**.

## 🤝 Contributing
Contributions are welcome! Please fork the repository and create a pull request with your changes.

## 📄 License
This project is licensed under the ISC License.
