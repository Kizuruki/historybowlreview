// node_extractor.js - Updated for multiple question sets and proper categorization
const fs = require('fs').promises;
const path = require('path');

// Official category mappings
const CATEGORY_MAP = {
  'us_history': {
    name: 'US History',
    subcategories: ['Government', 'Social', 'Military', 'Miscellaneous']
  },
  'european_history': {
    name: 'European History',
    subcategories: ['British', 'French', 'Russian', 'German', 'Western', 'Central/Eastern', 'Transnational/Other']
  },
  'world_history': {
    name: 'World History',
    subcategories: ['Asian', 'N. America (non-US)', 'African', 'S. American', 'Other']
  },
  'ancient_history': {
    name: 'Ancient History',
    subcategories: ['Roman', 'Non-Classical', 'Greek']
  },
  'other_history': {
    name: 'Other History',
    subcategories: ['Mixed/Other', 'Religious', 'Exploration', 'Non-US,Non-Eur.']
  },
  'pop_culture_sports_history': {
    name: 'Pop Culture/Sports History',
    subcategories: ['Pop Culture', 'Sports']
  },
  'social_science_philosophy': {
    name: 'Social Science/Philosophy',
    subcategories: ['Philosophy', 'Government/PoliSci', 'Sociology/Anthro.', 'Economics', 'Psychology', 'Archaeology', 'Other']
  },
  'recent_history': {
    name: 'Recent History (2000-Present)',
    subcategories: ['US', 'World']
  },
  'literature_history': {
    name: 'Literature History',
    subcategories: ['American', 'British', 'European', 'World']
  },
  'fine_arts_history': {
    name: 'Fine Arts History',
    subcategories: ['Music', 'Painting/Sculpture', 'Architecture', 'Any Fine Arts']
  },
  'geographical_history': {
    name: 'Geographical History',
    subcategories: ['N. America', 'Asia', 'Europe', 'Africa', 'S. America', 'Any Geography']
  },
  'math_science_history': {
    name: 'Math and Science History',
    subcategories: ['Mathematics', 'Biology', 'Astronomy', 'Chemistry', 'Physics', 'Inventions']
  },
  'mythology': {
    name: 'Mythology',
    subcategories: ['Classical', 'Norse', 'Non-European', 'Non-Classical', 'Any Mythology']
  }
};

const SUB_SUBCATEGORIES = ['people', 'places', 'things', 'events'];

// Parse filename to get category
function parseCategoryFromFilename(filename) {
  // Remove question set letter (a, c, etc.) and .json
  const cleaned = filename.replace(/^[a-z]/, '').replace('.json', '').replace(/_questions$/, '');
  
  // Map to official category
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (cleaned.toLowerCase().replace(/_/g, '') === key.replace(/_/g, '')) {
      return { key, ...value };
    }
  }
  
  return null;
}

async function extractNodesFromQuestion(question, answer, category, subcategories) {
  const prompt = `Extract historical entities and assign proper categorization.

Question: "${question}"
Answer: "${answer}"
Main Category: ${category.name}
Available Subcategories: ${subcategories.join(', ')}
Sub-subcategories: people, places, things, events

Return ONLY valid JSON:
{
  "nodes": [
    {
      "name": "Reconstruction Acts",
      "type": "event",
      "category": "${category.name}",
      "subcategory": "Government",
      "subsubcategory": "events"
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

Choose the MOST SPECIFIC subcategory from the list. Sub-subcategory must be one of: people, places, things, events.`;

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
  
  const cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

async function processQuestionSet(filePath) {
  const filename = path.basename(filePath);
  const category = parseCategoryFromFilename(filename);
  
  if (!category) {
    console.warn(`Could not parse category from filename: ${filename}`);
    return null;
  }
  
  console.log(`Processing ${filename} -> ${category.name}`);
  
  const content = await fs.readFile(filePath, 'utf8');
  const questions = JSON.parse(content);
  
  const allNodes = [];
  const allRelationships = [];
  
  for (const q of questions) {
    try {
      const extracted = await extractNodesFromQuestion(
        q.question,
        q.answer,
        category,
        category.subcategories
      );
      
      allNodes.push(...extracted.nodes);
      allRelationships.push(...extracted.relationships);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error processing question: ${error.message}`);
    }
  }
  
  return { nodes: allNodes, relationships: allRelationships, category: category.name };
}

async function processAllQuestionSets() {
  const basePath = './historybowlquestionsets/categories';
  const questionSetLetters = ['a', 'c'];
  const allNodes = [];
  const allRelationships = [];
  
  for (const letter of questionSetLetters) {
    const letterPath = path.join(basePath, letter);
    
    try {
      const files = await fs.readdir(letterPath);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const filePath = path.join(letterPath, file);
        const result = await processQuestionSet(filePath);
        
        if (result) {
          allNodes.push(...result.nodes);
          allRelationships.push(...result.relationships);
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${letterPath}: ${error.message}`);
    }
  }
  
  // Save combined results
  await fs.writeFile(
    './graph_data/all_nodes.json',
    JSON.stringify(allNodes, null, 2)
  );
  
  await fs.writeFile(
    './graph_data/all_relationships.json',
    JSON.stringify(allRelationships, null, 2)
  );
  
  console.log(`Processed ${allNodes.length} nodes and ${allRelationships.length} relationships`);
}

// Run if called directly
if (require.main === module) {
  processAllQuestionSets().catch(console.error);
}

module.exports = { processAllQuestionSets, extractNodesFromQuestion };
