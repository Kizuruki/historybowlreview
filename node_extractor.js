// node_extractor.js
async function extractNodesFromQuestion(question, answer, quarter, division) {
  const prompt = `Extract historical entities from this question. Return ONLY valid JSON.

Question: "${question}"
Answer: "${answer}"
Division: ${division}

Return format:
{
  "nodes": [
    {
      "name": "Reconstruction Acts",
      "type": "event",
      "division": "us_history",
      "subdivision": "government"
    }
  ],
  "relationships": [
    {
      "from": "Reconstruction Acts",
      "to": "Radical Republicans",
      "relation": "enacted_by"
    }
  ]
}

Types: person, event, place, concept
Relations: caused, opposed, led, enacted_by, occurred_in, related_to`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await response.json();
  const text = data.content[0].text;
  
  // Clean and parse JSON
  const cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// Generate summary for a node
async function generateNodeSummary(nodeName, relatedQuestions) {
  const questionsText = relatedQuestions.map(q => q.question).join('\n');
  
  const prompt = `Write a concise 2-3 paragraph summary about "${nodeName}" for History Bowl study.
Use these questions as context:

${questionsText}

Focus on: what it was, when it happened, key people involved, historical significance.
Write at high school level. Do not use bullet points.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await response.json();
  return data.content[0].text;
}
