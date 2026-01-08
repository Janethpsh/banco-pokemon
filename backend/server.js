// backend/server.js
import dotenv from "dotenv";
dotenv.config(); // <<< SIEMPRE PRIMERO (antes de importar app/pool)

import app from "./src/app.js";

const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, () => {
  console.log(`✅ Backend Pokémon Bank corriendo en http://localhost:${PORT}`);
  console.log("DB:", {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    name: process.env.DB_NAME,
    port: process.env.DB_PORT,
  });
});
