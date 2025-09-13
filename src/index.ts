import express, { Request, Response } from 'express';
import 'dotenv/config';
import cors from 'cors';
import OpenAI from 'openai';
import { Conversation, Msg } from './models';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(cors({ origin: '*' }));
app.use(express.json());

/**
 * @deprecated This is not used in this version since a prepended context is more efficient than RAG on small context. This feature will be maintained in future versions and variants.
 * @param url 
 * @returns 
 */
async function fetchWebContent(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        const html = await response.text();
        
        // Parse HTML and extract text content
        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        // Get main content (try main, article, or body)
        const mainContent = document.querySelector('main') || 
                          document.querySelector('article') || 
                          document.querySelector('.content') ||
                          document.body;
        
        const textContent = mainContent?.textContent || '';
        
        // Clean up whitespace and limit length
        const cleanText = textContent
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 2000);
            
        return cleanText;
    } catch (error) {
        console.error('Failed to fetch web content:', error);
        return '';
    }
}

async function getSystemPrependedMessage(): Promise<Array<Msg>> {
    const websiteContext = fs.readFileSync(path.join(__dirname, 'data', 'context-summary.txt'), 'utf-8');
    const preprompt = fs.readFileSync(path.join(__dirname, 'data', 'preprompt.txt'), 'utf-8');
    const systemMessages = [
        new Msg({
            conversation_id: -1,
            content: `Voici quelques informations sur l'entreprise pour t'aider à répondre aux questions des utilisateurs :\n\n ${websiteContext}`,
            sender_type: 'system'
        }),
        new Msg({
            conversation_id: -1,
            content: preprompt,
            sender_type: 'system'
        })
    ]
    return systemMessages;
}

async function responseTurn(conversationId: any, userMessage: string) {
    const conversationHistory = await Msg.findByConversationId(conversationId);

    // Prepare the user messages
    const userMessageObj = new Msg({
        conversation_id: conversationId,
        content: userMessage,
        sender_type: 'user'
    });

    // Persist and push the user message
    await userMessageObj.save();
    conversationHistory.push(userMessageObj);

    // Prepend the system message
    const systemMessages = await getSystemPrependedMessage();
    conversationHistory.unshift(...systemMessages);

    // Build OpenAI messages array
    const messages = conversationHistory
        .filter(msg => msg.content && msg.content.trim() !== '')
        .map(msg => {
            if (msg.sender_type === 'user') {
                return { role: "user" as const, content: msg.content! };
            } else if (msg.sender_type === 'bot') {
                return { role: "assistant" as const, content: msg.content! };
            } else if (msg.sender_type === 'system') {
                return { role: "system" as const, content: msg.content! };
            }
            return { role: "assistant" as const, content: msg.content! };
        });

    console.log("================")
    console.log(messages);
    console.log("================")
    const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        // model: "gpt-4.1-nano",
        // model: "gpt-5-mini",
        messages: messages,
    });

    let reply = completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
    // Save the assistant's reply to the database
    const replyObj = await Msg.create({
        conversation_id: conversationId,
        content: reply,
        sender_type: 'bot'
    });
    replyObj.save();

    return replyObj;
}

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript + Express!');
});

// Send a message to the chatbot and receive AI response via SSE
app.post('/api/chat', async (req: Request, res: Response) => {
    try {
        const { content: message, conversation_id: conversationId } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        let currentConversationId = conversationId;

        if (!conversationId) {
            const conversation = await Conversation.create();
            currentConversationId = conversation.id!;
        }

        // Set up Server-Sent Events headers
        res.set({
            'Cache-Control': 'no-cache',
            'Content-Type': 'text/event-stream',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });
        res.flushHeaders();

        // Send immediate acknowledgment (Response 1)
        res.write(`data: ${JSON.stringify({
            type: 'acknowledgment',
            status: 'processing',
            message: 'Message received and being processed',
            conversationId: currentConversationId
        })}\n\n`);

        try {
            // Process the response asynchronously
            const reply = await responseTurn(currentConversationId, message);

            // Send the LLM response (Response 2)
            res.write(`data: ${JSON.stringify({
                type: 'response',
                status: 'completed',
                reply: reply,
                conversationId: currentConversationId
            })}\n\n`);

        } catch (error) {
            console.error('OpenAI API error:', error);
            // Send error response
            res.write(`data: ${JSON.stringify({
                type: 'error',
                status: 'error',
                error: 'Failed to get AI response'
            })}\n\n`);
        }

        // Close the SSE connection
        res.end();

    } catch (error) {
        console.error('Request processing error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to process request' });
        }
    }
});

// Create a new chat session for user
app.post('/api/chat/sessions', (req: Request, res: Response) => {
  
});

// Get chat history for a specific session
app.get('/api/chat/sessions/:sessionId/messages', (req: Request, res: Response) => {
  
});

// Delete a chat session and its history
app.delete('/api/chat/sessions/:sessionId', (req: Request, res: Response) => {
  
});

// Get list of all chat sessions for a user
app.get('/api/chat/sessions', (req: Request, res: Response) => {
  
});

// Clear all messages in a specific session
app.delete('/api/chat/sessions/:sessionId/messages', (req: Request, res: Response) => {
  
});

// Health check endpoint for chatbot service
app.get('/api/health', (req: Request, res: Response) => {
  
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});