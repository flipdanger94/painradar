import { serve } from "inngest/next";
import {
  inngest,
  invoiceReconciliationTask,
  invoiceReconciliationWorker,
  maintenanceWorker,
  dailyPipeline,
  webhookWorker,
  publicationTask,
  publicationWorker,
  billingReconciliationTask,
  billingReconciliationWorker,
} from "@/lib/jobs";
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    invoiceReconciliationTask,
    invoiceReconciliationWorker,
    maintenanceWorker,
    dailyPipeline,
    webhookWorker,
    publicationTask,
    publicationWorker,
    billingReconciliationTask,
    billingReconciliationWorker,
  ],
});

export const maxDuration = 300;
