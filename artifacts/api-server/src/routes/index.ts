import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import organizationsRouter from "./organizations";
import pagesRouter from "./pages";
import conversationsRouter from "./conversations";
import leadsRouter from "./leads";
import automationRouter from "./automation";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import settingsRouter from "./settings";
import teamRouter from "./team";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(organizationsRouter);
router.use(pagesRouter);
router.use(conversationsRouter);
router.use(leadsRouter);
router.use(automationRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(settingsRouter);
router.use(teamRouter);

export default router;
