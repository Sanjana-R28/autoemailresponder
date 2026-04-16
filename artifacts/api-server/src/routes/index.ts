import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import emailRouter from "./email.js";
import gmailRouter from "./gmail.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(emailRouter);
router.use(gmailRouter);

export default router;
