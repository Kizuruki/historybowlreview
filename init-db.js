// graph-db.js
export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('HistoryBowlGraph', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Nodes store
      const nodesStore = db.createObjectStore('nodes', { keyPath: 'id' });
      nodesStore.createIndex('by-division', 'division');
      nodesStore.createIndex('by-subdivision', 'subdivision');
      nodesStore.createIndex('by-type', 'type');
      
      // Relationships store
      const relsStore = db.createObjectStore('relationships', { keyPath: 'id', autoIncrement: true });
      relsStore.createIndex('by-from', 'from_node');
      relsStore.createIndex('by-to', 'to_node');
      
      // Node questions store
      const nqStore = db.createObjectStore('node_questions', { keyPath: 'id', autoIncrement: true });
      nqStore.createIndex('by-node', 'node_id');
      nqStore.createIndex('by-question', 'question_id');
      
      // User progress store
      db.createObjectStore('user_progress', { keyPath: 'node_id' });
      
      // Wrong answers store
      db.createObjectStore('wrong_answers', { keyPath: 'id', autoIncrement: true });
    };
  });
}

export async function getNodesByDivision(db, division) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('nodes', 'readonly');
    const store = tx.objectStore('nodes');
    const index = store.index('by-division');
    const request = index.getAll(division.toLowerCase().replace(/ /g, '_'));
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getRelatedNodes(db, nodeId) {
  return new Promise(async (resolve, reject) => {
    const tx = db.transaction(['relationships', 'nodes'], 'readonly');
    const relsStore = tx.objectStore('relationships');
    const nodesStore = tx.objectStore('nodes');
    
    // Get all relationships where this node is involved
    const fromIndex = relsStore.index('by-from');
    const toIndex = relsStore.index('by-to');
    
    const fromRels = await fromIndex.getAll(nodeId);
    const toRels = await toIndex.getAll(nodeId);
    
    const relatedIds = new Set([
      ...fromRels.map(r => r.to_node),
      ...toRels.map(r => r.from_node)
    ]);
    
    const related = [];
    for (const id of relatedIds) {
      const node = await nodesStore.get(id);
      if (node) related.push(node);
    }
    
    resolve(related);
  });
}

export async function updateProgress(db, nodeId, correct, mode) {
  return new Promise(async (resolve, reject) => {
    const tx = db.transaction('user_progress', 'readwrite');
    const store = tx.objectStore('user_progress');
    
    let progress = await store.get(nodeId);
    if (!progress) {
      progress = {
        node_id: nodeId,
        stars: 0,
        platinum_until: null,
        times_correct: 0,
        times_wrong: 0,
        last_practiced: Date.now()
      };
    }
    
    if (correct) {
      progress.times_correct++;
      
      // Award stars based on mode
      if (mode === 'initial' && progress.stars === 0) {
        progress.stars = 1;
      } else if (mode === 'practice' && progress.stars === 1) {
        progress.stars = 2;
      } else if (mode === 'advanced' && progress.stars === 2) {
        progress.stars = 3;
        progress.platinum_until = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
      } else if (mode === 'advanced' && progress.stars === 3) {
        // Refresh platinum
        progress.platinum_until = Date.now() + (30 * 24 * 60 * 60 * 1000);
      }
    } else {
      progress.times_wrong++;
    }
    
    progress.last_practiced = Date.now();
    
    const request = store.put(progress);
    request.onsuccess = () => resolve(progress);
    request.onerror = () => reject(request.error);
  });
}
