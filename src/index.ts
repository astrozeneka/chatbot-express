import express, { Request, Response } from 'express';
import 'dotenv/config';
import OpenAI from 'openai';

const app = express();
const port = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, TypeScript + Express!');
});

// Send a message to the chatbot and receive AI response
app.post('/api/chat', async (req: Request, res: Response) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: message }],
        });

        const reply = completion.choices[0]?.message?.content || "Sorry, I couldn't generate a response.";
        res.json({ reply });
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