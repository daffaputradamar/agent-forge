# Agent Builder App

## Overview

The Agent Builder App is a web-based platform that allows users to create, customize, and deploy AI agents with domain-specific knowledge. Users can build agents with custom personalities, upload knowledge documents, and engage in conversations with their agents. The platform supports multi-agent management, knowledge base integration, and real-time chat functionality.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent UI patterns
- **State Management**: TanStack Query for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation schemas
- **Component Structure**: Modular component architecture with reusable UI components

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API endpoints organized by resource type (agents, knowledge, conversations, messages)
- **File Handling**: Multer for multipart file uploads with memory storage
- **Request Logging**: Custom middleware for API request/response logging

### Data Storage Solutions
- **Database**: PostgreSQL via Neon serverless connection
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for database migrations and schema management
- **Connection Pooling**: Neon serverless connection pooling with WebSocket support

### Database Schema Design
- **Users**: User accounts with authentication credentials
- **Agents**: AI agent configurations with personality settings, system instructions, and status tracking
- **Knowledge Documents**: Document storage with metadata, file processing status, and vector embeddings
- **Conversations**: Chat session management with agent associations
- **Messages**: Individual chat messages with role-based storage (user/assistant)

### AI Integration
- **AI Provider**: OpenAI GPT-5 for natural language processing
- **Knowledge Processing**: Document content extraction and embedding generation for RAG (Retrieval Augmented Generation)
- **Response Generation**: Hybrid system combining agent personality, knowledge base retrieval, and conversation context

### Authentication & Authorization
- **Current Implementation**: Demo user system for development
- **Future Architecture**: Designed for session-based authentication with user-specific data isolation
- **Data Isolation**: All resources are scoped to user accounts for multi-tenancy

## External Dependencies

### Core Services
- **Neon Database**: Serverless PostgreSQL hosting for primary data storage
- **OpenAI API**: GPT-5 model for AI agent responses and natural language processing

### Frontend Libraries
- **Radix UI**: Headless component primitives for accessible UI components
- **Embla Carousel**: Carousel functionality for content display
- **React Dropzone**: File upload interface with drag-and-drop support
- **Date-fns**: Date formatting and manipulation utilities

### Development Tools
- **Vite**: Frontend build tool with hot module replacement
- **ESBuild**: Backend bundling for production builds
- **Replit Integration**: Development environment support with error overlays and cartographer
- **TypeScript**: Static type checking across the entire application stack

### Utility Libraries
- **Zod**: Runtime type validation and schema definitions
- **Clsx/Tailwind-merge**: Conditional CSS class management
- **Nanoid**: Unique ID generation for various entities