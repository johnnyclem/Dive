import axios from "axios";
import express from "express";
import fs from "fs/promises";
import { initChatModel } from "langchain/chat_models/universal";
import multer from "multer";
import path from "path";
import { MCPClient } from "./client.js";
import { getChatWithMessages } from "./database/index.js";
import { PromptManager } from "./prompt/index.js";
import { createRouter } from "./routes/index.js";
import { handleUploadFiles } from "./utils/fileHandler.js";
import logger from "./utils/logger.js";
import { iModelConfig, iQueryInput, iStreamMessage, ModelSettings } from "./utils/types.js";
import envPaths from "env-paths";

const envPath = envPaths("dive", {suffix: ""})
const PROJECT_ROOT = envPath.data;

const OFFLINE_MODE = process.env.OFFLINE_MODE === "true";

export class WebServer {
  private app;
  private mcpClient;
  private promptManager;
  private upload;
  public port: number | undefined;

  constructor(mcpClient: MCPClient) {
    this.app = express();
    this.mcpClient = mcpClient;
    this.promptManager = PromptManager.getInstance();
    this.port = undefined;

    // resolve cors
    this.app.use((req: any, res: any, next: any) => {
      res.header("Access-Control-Allow-Origin", "http://localhost:5173");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");

      if (req.method === "OPTIONS") {
        return res.sendStatus(200);
      }

      next();
    });

    // Set up file upload
    const storage = multer.diskStorage({
      //@ts-ignore
      destination: (req, file, cb) => {
        const uploadDir = path.join(PROJECT_ROOT, "uploads");
        // Ensure upload directory exists
        fs.mkdir(uploadDir, { recursive: true })
          .then(() => cb(null, uploadDir))
          .catch((err) => cb(err, uploadDir));
      },
      //@ts-ignore
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      },
    });

    this.upload = multer({
      storage: storage,
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5,
      },
    }).array("files", 5);

    // Set up template engine
    this.app.set("view engine", "ejs");
    this.app.set("views", path.join(PROJECT_ROOT, "views"));

    // Middleware
    this.app.use(express.json());
    this.app.use(express.static(path.join(PROJECT_ROOT, "views/public")));
    this.app.use("/uploads", express.static(path.join(PROJECT_ROOT, "uploads")));

    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.use("/", createRouter());

    // API endpoint for sending messages
    //@ts-ignore
    this.app.post("/api/chat", (req, res) => {
      this.upload(req, res, async (err) => {
        if (err) {
          logger.error(`File upload error: ${err.message}`);
          return res.status(400).json({
            success: false,
            message: err.message,
          });
        }

        try {
          const { message, chatId } = req.body;
          const files = req.files as Express.Multer.File[];
          // Only allow filepaths parameter in offline mode
          let filepaths = [] as string[];

          const bodyFilepaths = req.body.filepaths;
          if (bodyFilepaths) {
            if (OFFLINE_MODE) {
              filepaths = typeof bodyFilepaths === "string" ? JSON.parse(bodyFilepaths || "[]") : bodyFilepaths;
            } else {
              logger.error("filepaths arg is not allowed in online mode");
            }
          }

          if (!message && (!files || files.length === 0) && (!filepaths || filepaths.length === 0)) {
            return res.status(400).json({
              success: false,
              message: "Message or Files/FilePaths are required",
            });
          }

          // Set up SSE headers
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");

          const onStream = (text: string) => {
            res.write(`data: ${JSON.stringify({ message: text })}\n\n`);
          };

          // Prepare query input
          const queryInput: iQueryInput = {};

          if (message) {
            queryInput.text = message;
          }

          // Process uploaded files
          if (files?.length > 0 || filepaths?.length > 0) {
            // Handle both file paths and file instances
            const processFiles = {
              files: files,
              filepaths: filepaths,
            } as { files: Express.Multer.File[]; filepaths: string[] };
            const { images, documents } = await handleUploadFiles(processFiles);
            queryInput.images = images;
            queryInput.documents = documents;
          }

          await this.mcpClient.processQuery(chatId, queryInput, onStream);

          res.write("data: [DONE]\n\n");
          res.end();
        } catch (error) {
          logger.error(`Chat error: ${(error as Error).message}`);
          const response = {
            type: "error",
            content: (error as Error).message,
          } as iStreamMessage;
          res.write(`data: ${JSON.stringify({ message: response })}\n\n`);
          res.end();
        }
      });
    });

    //@ts-ignore
    this.app.post("/api/chat/retry", async (req, res) => {
      const { chatId, messageId } = req.body;
      if (!chatId || !messageId) {
        return res.status(400).json({
          success: false,
          message: "Chat ID and Message ID are required",
        });
      }
      try {
        // Set up SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        const onStream = (text: string) => {
          res.write(`data: ${JSON.stringify({ message: text })}\n\n`);
        };
        // Prepare query input
        await this.mcpClient.processQuery(chatId, "", onStream, messageId);
        res.write("data: [DONE]\n\n");
        res.end();
      } catch (error) {
        logger.error(`Chat error: ${(error as Error).message}`);
        const response = {
          type: "error",
          content: (error as Error).message,
        } as iStreamMessage;
        res.write(`data: ${JSON.stringify({ message: response })}\n\n`);
        res.end();
      }
    });

    this.app.get("/api/suggestion/:chatId", async (req, res) => {
      const chatId = req.params.chatId;
      const result = await getChatWithMessages(chatId);
      if (!result) {
        res.status(404).json({
          success: false,
          message: "Chat not found",
        });
        return;
      }
      const history = result.messages;
      const response = await axios.post("https://api.biggo.com/api/v1/searchai/backend/suggestions", {
        chat_model: "GPT-4o-mini",
        chat_model_provider: "openai",
        chat_history: history,
      });
      const suggestions = response?.data?.suggestions;
      res.json({
        success: true,
        data: suggestions,
      });
    });

    this.app.post("/api/modelVerify", async (req, res) => {
      try {
        const { modelSettings } = req.body;
        if (!modelSettings) {
          res.json({
            success: false,
            message: "Config is required",
          });
          return;
        }
        const modelName = (modelSettings as ModelSettings).model;
        const baseUrl =
          (modelSettings as ModelSettings).configuration?.baseURL ||
          (modelSettings as ModelSettings).baseURL ||
          "";
        const model = await initChatModel(modelName, {
          ...(modelSettings as ModelSettings),
          baseUrl,
          max_tokens: 5,
        });
        const result = await model.invoke("Only return 'Hi' strictly");
        res.json({
          success: true,
          data: result.lc_kwargs,
        });
      } catch (error) {
        logger.error(`Model verification error: ${(error as Error).message}`);
        res.json({
          success: false,
          message: (error as Error).message,
        });
      }
    });
  }

  start(port: number = 4321): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = this.app
        .listen(port, () => {
          const address = server.address();
          const actualPort = typeof address === "object" && address ? address.port : port;
          logger.info(`Web server running at http://localhost:${actualPort}`);
          this.port = actualPort;
          resolve(actualPort);
        })
        .on("error", (err) => {
          reject(err);
        });
    });
  }
}
