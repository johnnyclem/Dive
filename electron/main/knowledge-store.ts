// Knowledge base storage module for Electron main process

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const dataFilePath = path.join(app.getPath('userData'), 'knowledge-store.json');

// Load persisted store on startup
;(function loadStore() {
  try {
    if (fs.existsSync(dataFilePath)) {
      const fileData = fs.readFileSync(dataFilePath, 'utf-8');
      const store: {
        knowledgeBases: KnowledgeBase[];
        knowledgeCollections: KnowledgeCollection[];
        activeKnowledgeBaseId: string | null;
      } = JSON.parse(fileData);
      knowledgeBases.splice(0, knowledgeBases.length, ...store.knowledgeBases);
      knowledgeCollections.splice(0, knowledgeCollections.length, ...store.knowledgeCollections);
      activeKnowledgeBaseId = store.activeKnowledgeBaseId;
    }
  } catch (e) {
    console.error('Failed to load knowledge store:', e);
  }
})();

function saveStore() {
  try {
    const store = { knowledgeBases, knowledgeCollections, activeKnowledgeBaseId };
    fs.writeFileSync(dataFilePath, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save knowledge store:', e);
  }
}

// Define types
export interface Document {
  id: string;
  name: string;
  path: string;
  content: string;
  dateAdded: Date;
}

export interface KnowledgeCollection {
  id: string;
  name: string;
  description?: string;
  documents: Document[];
}

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  content?: string;
}

// In-memory storage
const knowledgeBases: KnowledgeBase[] = [];
const knowledgeCollections: KnowledgeCollection[] = [];
let activeKnowledgeBaseId: string | null = null;

// Active knowledge base management
export function setActiveKnowledgeBase(id: string | null): boolean {
  console.log(`Setting active knowledge base: ${id}`);
  // Check if the ID exists if not null
  if (id !== null && !getCollection(id)) {
    console.log(`Knowledge base ${id} not found, cannot activate`);
    return false;
  }
  
  activeKnowledgeBaseId = id;
  saveStore();
  console.log(`Active knowledge base is now: ${activeKnowledgeBaseId}`);
  return true;
}

export function getActiveKnowledgeBase(): string | null {
  return activeKnowledgeBaseId;
}

// Collection methods
export function getAllCollections(): KnowledgeCollection[] {
  console.log(`Getting all collections. Count: ${knowledgeCollections.length}`);
  return knowledgeCollections;
}

export function getCollection(id: string | number): KnowledgeCollection | undefined {
  console.log(`Looking for collection: ${id}`);
  return knowledgeCollections.find(c => c.id === id.toString());
}

export function createCollection(name: string, description?: string): KnowledgeCollection {
  console.log(`Creating collection: ${name}`);
  const id = `collection-${Date.now()}`;
  const newCollection: KnowledgeCollection = { 
    id, 
    name, 
    description, 
    documents: [] 
  };
  knowledgeCollections.push(newCollection);
  saveStore();
  console.log(`Created collection with ID: ${id}`);
  return newCollection;
}

export function getDocumentsForCollection(collectionId: string | number): Document[] {
  console.log(`Getting documents for collection: ${collectionId}`);
  const collection = getCollection(collectionId);
  if (!collection) {
    console.log(`Collection ${collectionId} not found`);
    return [];
  }
  console.log(`Found ${collection.documents.length} documents`);
  return collection.documents;
}

export function addDocumentToCollection(collectionId: string | number, document: Document): boolean {
  console.log(`Adding document to collection: ${collectionId}`);
  const collection = getCollection(collectionId);
  
  if (collection) {
    collection.documents.push(document);
    saveStore();
    console.log(`Added document ${document.id} to collection ${collectionId}`);
    return true;
  } 
  
  // If collection doesn't exist, create it
  const newCollection: KnowledgeCollection = {
    id: collectionId.toString(),
    name: `Collection ${collectionId}`,
    documents: [document]
  };
  
  knowledgeCollections.push(newCollection);
  saveStore();
  console.log(`Created new collection ${collectionId} and added document ${document.id}`);
  return true;
}

export function removeDocumentFromCollection(documentId: string): boolean {
  console.log(`Removing document: ${documentId}`);
  let removed = false;
  
  // Look through all collections for the document
  for (const collection of knowledgeCollections) {
    const index = collection.documents.findIndex(doc => doc.id === documentId);
    if (index >= 0) {
      collection.documents.splice(index, 1);
      saveStore();
      removed = true;
      console.log(`Removed document ${documentId} from collection ${collection.id}`);
      break;
    }
  }
  
  return removed;
}

// Enhanced search function for knowledge base
export function searchKnowledgeBase(query: string, collectionId?: string | null, k: number = 5): Array<{document: Document, score: number}> {
  if (!query) {
    console.log('Empty query provided to searchKnowledgeBase, returning no results');
    return [];
  }
  console.log(`Searching knowledge base for: ${query}`);
  const normalizedQuery = query.toLowerCase();
  const results: Array<{document: Document, score: number}> = [];
  
  // If collection ID is provided, search only that collection
  if (collectionId) {
    const collection = getCollection(collectionId);
    if (!collection) {
      console.log(`Collection ${collectionId} not found for search`);
      return [];
    }
    
    // Score each document and add to results
    collection.documents.forEach(doc => {
      const score = computeRelevanceScore(doc, normalizedQuery);
      if (score > 0) {
        results.push({ document: doc, score });
      }
    });
  } 
  // Otherwise search all collections
  else {
    knowledgeCollections.forEach(collection => {
      collection.documents.forEach(doc => {
        const score = computeRelevanceScore(doc, normalizedQuery);
        if (score > 0) {
          results.push({ document: doc, score });
        }
      });
    });
  }
  
  // Sort by relevance score (highest first)
  results.sort((a, b) => b.score - a.score);
  
  // Return top k results
  return results.slice(0, k);
}

// Simple term frequency-based relevance scoring
function computeRelevanceScore(document: Document, query: string): number {
  const content = document.content.toLowerCase();
  const name = document.name.toLowerCase();
  
  // Split into terms
  const queryTerms = query.split(/\s+/).filter(term => term.length > 1);
  
  let score = 0;
  
  // Add to score for each query term found in content
  queryTerms.forEach(term => {
    // Count occurrences in content
    const contentMatches = (content.match(new RegExp(term, 'g')) || []).length;
    score += contentMatches * 1;
    
    // Boost score for terms found in document name
    if (name.includes(term)) {
      score += 5;
    }
    
    // Exact phrase match bonus in content
    if (content.includes(query)) {
      score += 10;
    }
  });
  
  return score;
}

// Knowledge base methods
export function getAllKnowledgeBases(): KnowledgeBase[] {
  console.log(`Getting all knowledge bases. Count: ${knowledgeBases.length}`);
  return knowledgeBases;
}

export function createKnowledgeBase(name: string, content: string, description?: string): KnowledgeBase {
  console.log(`Creating knowledge base: ${name}`);
  const id = `kb-${Date.now()}`;
  const newKB: KnowledgeBase = { 
    id, 
    name, 
    description, 
    content 
  };
  knowledgeBases.push(newKB);
  saveStore();
  console.log(`Created knowledge base with ID: ${id}`);
  return newKB;
}

export function removeKnowledgeBase(id: string): boolean {
  console.log(`Removing knowledge base: ${id}`);
  const index = knowledgeBases.findIndex(kb => kb.id === id);
  if (index !== -1) {
    knowledgeBases.splice(index, 1);
    saveStore();
    console.log(`Removed knowledge base ${id}`);
    return true;
  }
  console.log(`Knowledge base ${id} not found`);
  return false;
}

// Add some sample data for testing
export function addSampleData() {
  if (knowledgeCollections.length === 0) {
    const sampleCollection = createCollection('Sample Collection', 'Sample description');
    
    const doc1: Document = {
      id: 'doc-1',
      name: 'Sample Document 1',
      path: '/path/to/sample1.txt',
      content: 'This is the content of sample document 1.',
      dateAdded: new Date()
    };
    
    const doc2: Document = {
      id: 'doc-2',
      name: 'Sample Document 2',
      path: '/path/to/sample2.txt',
      content: 'This is the content of sample document 2.',
      dateAdded: new Date()
    };
    
    // Add a document about Think OS
    const thinkOSDoc: Document = {
      id: 'doc-thinkos',
      name: 'Think OS Book',
      path: '/path/to/thinkos.txt',
      content: `Think OS: A Brief Introduction to Operating Systems by Allen B. Downey.
        
Think OS is an introduction to Operating Systems for programmers.

In many computer science programs, Operating Systems is an advanced topic. By the time students 
take it, they usually know how to program in C, and they have probably taken a class in Computer Architecture.
Usually the goal of the class is to expose students to the design and implementation of operating systems,
with the implied assumption that some of them will do research in this area, or write part of an OS.

This book is intended for a different audience, and it has different goals. I developed it for a class 
at Olin College called Software Systems. Most students taking this class learned to program in Python, 
so one of the goals is to help them learn C. For that part of the class, I use Griffiths and Griffiths, 
Head First C, from O'Reilly Media. This book is meant to complement that one.

Few of my students will ever write an operating system, but many of them will write low-level applications in C, 
and some of them will work on embedded systems. My class includes material from operating systems, networks, 
databases, and embedded systems, but it emphasizes the topics programmers need to know.

This book does not assume that you have studied Computer Architecture. As we go along, I will explain 
what we need. If this book is successful, it should give you a better understanding of what is happening 
when programs run, and what you can do to make them run better and faster.`,
      dateAdded: new Date()
    };
    
    addDocumentToCollection(sampleCollection.id, doc1);
    addDocumentToCollection(sampleCollection.id, doc2);
    addDocumentToCollection(sampleCollection.id, thinkOSDoc);
    
    // Set this collection as active for testing
    setActiveKnowledgeBase(sampleCollection.id);
    
    console.log('Added sample data including Think OS document');
  }
} 