import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { getDB } from "../database/index.js";
import { knowledgeBases, type KnowledgeBase as SchemaKnowledgeBase } from "../database/schema.js";
import { eq } from "drizzle-orm";
import logger from "../utils/logger.js";

export interface DocumentMetadata {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

class KnowledgeBaseManager {
  private static instance: KnowledgeBaseManager;
  private vectorStore: Chroma | null = null;
  private embeddings: OpenAIEmbeddings | null = null;
  private collectionName = "knowledge_base_documents";

  private constructor() {}

  public static getInstance(): KnowledgeBaseManager {
    if (!KnowledgeBaseManager.instance) {
      KnowledgeBaseManager.instance = new KnowledgeBaseManager();
    }
    return KnowledgeBaseManager.instance;
  }

  public async initialize() {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error("OpenAI API key not found in environment variables");
      }

      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: apiKey,
      });

      // Initialize Chroma with persistent storage
      this.vectorStore = await Chroma.fromDocuments(
        [], // Start with empty documents
        this.embeddings,
        {
          collectionName: this.collectionName,
          url: "http://localhost:8000", // Chroma server URL
        }
      );

      logger.info("Knowledge base manager initialized with persistent vector store");
    } catch (error) {
      logger.error("Failed to initialize knowledge base manager:", error);
      throw error;
    }
  }

  public async addDocument(content: string, metadata: DocumentMetadata) {
    if (!this.vectorStore || !this.embeddings) {
      throw new Error("Knowledge base manager not initialized");
    }

    try {
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const docs = await textSplitter.createDocuments([content], [metadata]);
      await this.vectorStore.addDocuments(docs);

      // Store in database
      const db = getDB();
      const now = new Date();
      const newKnowledgeBase = {
        id: metadata.id,
        name: metadata.name,
        description: metadata.description || null,
        createdAt: now,
        updatedAt: now,
      };
      await db.insert(knowledgeBases).values(newKnowledgeBase);

      logger.info(`Added document to knowledge base: ${metadata.name}`);
    } catch (error) {
      logger.error("Failed to add document to knowledge base:", error);
      throw error;
    }
  }

  public async similaritySearch(query: string, k: number = 4): Promise<Document[]> {
    if (!this.vectorStore) {
      throw new Error("Knowledge base manager not initialized");
    }

    try {
      const results = await this.vectorStore.similaritySearch(query, k);
      return results;
    } catch (error) {
      logger.error("Failed to perform similarity search:", error);
      throw error;
    }
  }

  public async listKnowledgeBases(): Promise<SchemaKnowledgeBase[]> {
    try {
      const db = getDB();
      return await db.select().from(knowledgeBases);
    } catch (error) {
      logger.error("Failed to list knowledge bases:", error);
      throw error;
    }
  }

  public async deleteKnowledgeBase(id: string) {
    try {
      const db = getDB();
      await db.delete(knowledgeBases).where(eq(knowledgeBases.id, id));
      
      if (this.vectorStore) {
        // Delete documents from vector store
        await this.vectorStore.delete({ filter: { id } });
      }
      
      logger.info(`Deleted knowledge base: ${id}`);
    } catch (error) {
      logger.error("Failed to delete knowledge base:", error);
      throw error;
    }
  }
}

export default KnowledgeBaseManager; 