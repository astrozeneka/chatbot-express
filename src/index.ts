import express, { Request, Response } from 'express';
import 'dotenv/config';
import OpenAI from 'openai';
import { Conversation, Msg } from './models';

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

// Simple web content fetcher
async function fetchWebContent(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        const text = await response.text();
        return text.substring(0, 1000); // Limit to 1000 chars
    } catch (error) {
        console.error('Failed to fetch web content:', error);
        return '';
    }
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

        let currentConversationId = conversationId;
        
        if (!conversationId) {
            const conversation = await Conversation.create();
            currentConversationId = conversation.id!;
        }

        await Msg.create({
            conversation_id: currentConversationId,
            content: message,
            sender_type: 'user'
        });

        // AI-powered resource selection
        const webSources = {
            'web-home': 'https://www.codecrane.me',
            'web-development-docs': 'https://www.codecrane.me/devweb',
            'mobile-development-docs': 'https://www.codecrane.me/devmobile'
        };
        
        const resourceDecision = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{
                role: "user",
                content: `Analyze this user question: "${message}"
                
Available resources:
- web-home: General website info
- web-development-docs: Web development documentation  
- mobile-development-docs: Mobile development documentation

Respond with only the resource name needed (or "none" if no resource is needed):`
            }],
            max_tokens: 50
        });
        console.log("==>", resourceDecision.choices[0]?.message?.content);
        const selectedResource = resourceDecision.choices[0]?.message?.content?.trim();
        let additionalContext = '';
        
        if (selectedResource && selectedResource !== 'none' && webSources[selectedResource as keyof typeof webSources]) {
            additionalContext = await fetchWebContent(webSources[selectedResource as keyof typeof webSources]);
        }
        
        // Combine user message with context
        const finalMessage = additionalContext 
            ? `Context: ${additionalContext}\n\nUser question: ${message}`
            : message;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: finalMessage }],
        });

        const reply = completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
        
        await Msg.create({
            conversation_id: currentConversationId,
            content: reply,
            sender_type: 'bot'
        });

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