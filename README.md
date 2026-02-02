# Wayvue | Trip Intelligence

Wayvue is an advanced trip intelligence application designed to enhance your travel experience by providing real-time weather updates, road conditions, and AI-powered route summaries.

## 🚀 Features

- **Interactive Map**: Visualize your route with real-time weather overlays and markers using Leaflet.
- **Trip Intelligence**: Get AI-powered summaries of your trip, including potential hazards and scenic recommendations.
- **Real-Time Weather**: View current temperature, wind speed, and precipitation along your route.
- **Road Conditions**: Stay informed about traffic alerts, construction zones, and accidents.
- **suggested Stops**: Discover interesting places to stop, including rest areas, scenic viewpoints, and restaurants.
- **Smart Routing**: Calculate the optimal route based on distance, time, and weather conditions.
- **Responsive Design**: Enjoy a seamless experience on both desktop and mobile devices with resizable panels.

## 🛠️ Tech Stack

### Client
- **Framework**: React 19
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 4
- **Maps**: Leaflet / React-Leaflet
- **Icons**: Lucide React
- **HTTP Client**: Axios

### Server
- **Runtime**: Node.js
- **Framework**: Express
- **Utilities**: Mapbox Polyline, Dotenv

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
    - Create a `.env` file in the `server` directory and add your API keys (e.g., Gemini, Mapbox, Weather APIs).
    - Create a `.env` file in the `client` directory if needed.

## 🏃‍♂️ Usage

1.  **Start the Backend Server**
    ```bash
    cd server
    node index.js
    ```
    The server typically runs on port `3000` or `5000`.

2.  **Start the Frontend Development Server**
    ```bash
    cd client
    npm run dev
    ```
    Access the application at `http://localhost:5173`.

## 🤝 Contributing

Contributions are welcome! Please fork the repository and create a pull request with your changes.

## 📄 License

This project is licensed under the ISC License.
