// Classify only known failures; never expose provider bodies, URLs or credentials.
export function pipelineError(message: string) {
  if (
    [
      "Gemini quota reached. Wait for the quota to renew, then continue processing.",
      "Gemini is not configured. Ask the administrator to finish AI setup.",
      "Gemini access was rejected. The administrator should check the API key and model access.",
      "The selected Gemini model is unavailable. Check the model configuration.",
      "Gemini is temporarily unavailable. Try processing again later.",
    ].includes(message)
  )
    return message;
  if (/Gemini quota exceeded/.test(message))
    return "Gemini quota reached. Wait for the quota to renew, then continue processing.";
  if (/Gemini is not configured/.test(message))
    return "Gemini is not configured. Ask the administrator to finish AI setup.";
  if (/Gemini request failed \(HTTP (401|403)\)/.test(message))
    return "Gemini access was rejected. The administrator should check the API key and model access.";
  if (/Gemini request failed \(HTTP 404\)/.test(message))
    return "The selected Gemini model is unavailable. Check the model configuration.";
  if (/Gemini request failed \(HTTP 5\d\d\)/.test(message))
    return "Gemini is temporarily unavailable. Try processing again later.";
  return "Processing failed. Review the job in Inngest before restarting.";
}
