import "dotenv/config";

import express from "express";
import cors from "cors";
import { sequelize } from "./db/conexion.js";
import { setupAssociations } from "./models/associations.js";

import { routerAuth } from "./router/authRouter.js";
import { dishRoutes } from "./router/dishRoutes.js";
import { orderRouter } from "./router/orderRouter.js";
import { routerUser } from "./router/UserRouter.js";
import { parentRouter } from "./router/parentRouter.js";
import { weeklyMenuRoutes } from "./router/weeklyMenuRoutes.js";
import categoryRoutes from "./router/categoryRouter.js";
import adminUserRouter from "./router/adminUserRouter.js";
import adminReportRouter from "./router/adminReportRouter.js";
import adminDashboardRouter from "./router/adminDashboardRouter.js";
import familyrouter from "./router/familyrouter.js";
import barRouter from "./router/barRouter.js";

const app = express();
const PORT = process.env.PORT || 3000;
console.log("SMTP_USER:", process.env.SMTP_USER);
console.log("SMTP_PASS largo:", process.env.SMTP_PASS?.length);
console.log("SMTP_PASS:", process.env.SMTP_PASS);

// =====================
// Middlewares
// =====================
const corsOptions = {
  origin: [
    "http://localhost:4200",
    "http://localhost:8100",
    "http://localhost",
    "https://localhost",
    "capacitor://localhost",
    "ionic://localhost",
    "https://aristos-klz.com",
    "https://www.aristos-klz.com",
    "https://api.aristos-klz.com"
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ✅ importante: JSON y urlencoded (ayuda a parsear bien algunos casos)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ servir uploads
app.use("/uploads", express.static("uploads"));

// =====================
// Asociaciones
// =====================
setupAssociations();

// =====================
// Rutas
// =====================
app.use("/api/auth", routerAuth);
app.use("/api", dishRoutes);
app.use("/api", orderRouter);
app.use("/api", routerUser);
app.use("/api/parent", parentRouter);
app.use("/api", weeklyMenuRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/admin/reports", adminReportRouter);
app.use("/api/admin/users", adminUserRouter);
app.use("/api/admin", adminDashboardRouter);
app.use("/api", familyrouter);
app.use("/api/bar", barRouter);
// health
app.get("/time", (req, res) => {
  res.json({ now: new Date(), local: new Date().toLocaleString() });
});

app.get("/", (req, res) => {
  res.json({ message: "Servidor TIC activo 🚀" });
});

// =====================
// Start
// =====================
const main = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Base de datos conectada correctamente.");
    await sequelize.sync();


    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error al iniciar el servidor:", error);
  }
};

main();
