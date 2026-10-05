import { NextRequest } from 'next/server';
import { handleRailBotChat } from '@/lib/railbot/chat-handler';
export const maxDuration = 300;
export async function POST(request: NextRequest) { return handleRailBotChat(request); }
