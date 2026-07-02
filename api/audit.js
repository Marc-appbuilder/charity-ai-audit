export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'No items provided' });
  }

  const prompt = `You are a workflow consultant specialising in the charity and non-profit sector. You understand the resource constraints, reliance on volunteers, and compliance requirements charities face.

A charity filled in a self-serve AI time audit. Here are the workflows they described, already ranked by hours lost per week × pain (1–5):

${JSON.stringify(items, null, 2)}

For each item, write a 1–2 sentence concrete suggestion grounded in realistic tools charities actually use (Beacon, Donorfy, Mailchimp, Microsoft 365, Google Workspace, Salesforce Nonprofit, Make, Zapier). Be specific — not vague "use AI". Then write a 2–3 sentence overall summary noting the biggest impact for a resource-constrained team, and pick which single item to address first and why (weigh both impact and how quickly it could realistically be implemented).

Respond with ONLY valid JSON, no markdown fences, no preamble, in this exact shape:
{"summary": "string", "firstBuildKey": "string matching one of the keys", "items": [{"key": "string", "automationIdea": "string"}]}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  return res.status(200).json(data);
}
