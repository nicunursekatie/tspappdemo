import { Router } from 'express';
import weeklyCollectionsRouter from './weekly-collections';
import groupCollectionsRouter from './group-collections';

const reportsRouter = Router();

reportsRouter.use('/weekly-collections', weeklyCollectionsRouter);
reportsRouter.use('/group-collections', groupCollectionsRouter);

export default reportsRouter;
