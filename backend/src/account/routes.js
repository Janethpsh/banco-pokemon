import { Router } from "express";
import { authRequired } from "../middlewares/auth.js";
import { me, saldo, agregarDinero, movimientos, depositar } from "./controller.js";

const router = Router();

router.get("/me", authRequired, me);
router.get("/saldo", authRequired, saldo);

router.post("/agregar-dinero", authRequired, agregarDinero);

router.get("/movimientos", authRequired, movimientos);

router.post("/depositar", authRequired, depositar);

export default router;
