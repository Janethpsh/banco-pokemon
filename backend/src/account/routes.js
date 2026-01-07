import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { me, saldo, agregarDinero, movimientos, depositar } from "./controller.js";

const router = Router();

router.get("/me", authRequired, me);
router.get("/saldo", authRequired, saldo);

// “Botón” de cash-in
router.post("/agregar-dinero", authRequired, agregarDinero);

// Movimientos bonitos
router.get("/movimientos", authRequired, movimientos);

// Si lo usas
router.post("/depositar", authRequired, depositar);

export default router;
