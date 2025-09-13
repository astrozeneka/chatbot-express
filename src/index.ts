import express, { Request, Response } from 'express';
import 'dotenv/config';
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

app.use(express.json());

// HTML content fetcher with text extraction
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

async function responseTurn(conversationId: any, userMessage: string, depth: number = 0) {
    if (depth > 3) {
        return "I'm having trouble accessing the requested resource. Please try rephrasing your question.";
    }
    // Get conversation history from database
    const conversationHistory = await Msg.findByConversationId(conversationId);
    // Create and append the user message
    const userMessageObj = new Msg({
        conversation_id: conversationId,
        content: userMessage,
        sender_type: 'user'
    });
    // Persist the user message
    await userMessageObj.save();
    // Add the user message to the history
    conversationHistory.push(userMessageObj);
    // The resource data
    const webSources = {
        'web-home': 'https://www.codecrane.me',
        'web-development-docs': 'https://www.codecrane.me/devweb',
        'mobile-development-docs': 'https://www.codecrane.me/devmobile',
        'faq': 'https://www.codecrane.me/faq'
    };
    // Append a system instruction message
    const systemMessage = new Msg({
        conversation_id: conversationId,
        content: `Tu es un assistant IA aimable et serviable pour répondre aux questions des utilisateurs qui travail pour le compte d'un agence de développement informatique. Évite de répondre par des réponses vagues comme les IA mal entraînées sur le web. Répond efficacement et précisément, n'épuise pas inutilement les jetons. Évite d'être trop verbeux et trop joyeux. Il est imporant que tu fournit des informations correctes et vérifiées (parmi les resources fournies). Si tu n'as pas la réponse, dis le simplement. Ne tente pas d'inventer des réponses. Sois pertinent, si l'utilisateur demande un numéro de téléphone, fournis le lui, s'il demande une adresse, fournis le lui (si l'information existe dans les ressources), s'il demande une information précise, fournis la lui, etc. Ne tourne pas autour du pot. `,
        sender_type: 'system'
    });
    conversationHistory.unshift(systemMessage);
    conversationHistory.push(new Msg({
        conversation_id: conversationId,
        content: `Analyse le message précédent et prends en compte l'historique de discussion pour formuler une réponse pertinente et utile. Garde en tête que l'utilisateur est un potentiel intéressé par nos services informatiques. Il est important de fournir des arguments convaincants. Ne sois pas trop verbeux.
N'invente pas des informations, si la réponse nécessite des informations spécifiques, alors réponds exactement "[fetch]resource_name" où resource_name est le nom de la ressource parmi les suivantes:
- web-home: General website info
- web-development-docs: Web development documentation  
- mobile-development-docs: Mobile development documentation
- faq: FAQ`,
        sender_type: 'system'
    }));
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
        // model: "gpt-3.5-turbo",
        // model: "gpt-4.1-nano",
        model: "gpt-5-mini",
        messages: messages,
    });
    let reply = completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
    // Check if the reply contains a fetch command
    const fetchMatch = reply.match(/\[fetch\]([a-zA-Z0-9_-]+)/);
    if (fetchMatch) {
        console.log("Fetch command detected:", fetchMatch[1]);
        const resourceName = fetchMatch[1];
        if (webSources[resourceName as keyof typeof webSources]) {
            const additionalContext = await fetchWebContent(webSources[resourceName as keyof typeof webSources]);
            console.log("Fetched context from:", webSources[resourceName as keyof typeof webSources]);
            // Add a system message with the fetched context
            await Msg.create({
                conversation_id: conversationId,
                content: `Fetching context from ${resourceName}: ${additionalContext}`,
                sender_type: 'system'
            });
            // Recurse to generate a new response with the additional context
            return await responseTurn(conversationId, userMessage, depth + 1);
        }
    }
    // Save the assistant's reply to the database
    await Msg.create({
        conversation_id: conversationId,
        content: reply,
        sender_type: 'bot'
    });
    return reply;
}

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript + Express!');
});

// Send a message to the chatbot and receive AI response
app.post('/api/chat', async (req: Request, res: Response) => {
    try {
        const { message, conversationId } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Read context file for additional context (uncomment and use as needed)
        // const contextPath = path.join(__dirname, 'data', 'context-summary.txt');
        // const contextContent = fs.readFileSync(contextPath, 'utf-8');
        // console.log('Context content:', contextContent);

        let currentConversationId = conversationId;
        
        if (!conversationId) {
            const conversation = await Conversation.create();
            currentConversationId = conversation.id!;
        }

        // call the responseTurn function
        const reply = await responseTurn(currentConversationId, message);

        res.json({ reply, conversationId: currentConversationId });
    } catch (error) {
        console.error('OpenAI API error:', error);
        res.status(500).json({ error: 'Failed to get AI response' });
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