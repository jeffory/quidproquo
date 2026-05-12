---
sidebar_position: 1
---

# Packages

QuidProQuo is a monorepo of focused packages that work together to build full-stack applications using a unified action-based programming model. This section documents each package — what it does, what it exports, and when to use it.

## Package Map

| Package | Purpose |
|---|---|
| [`quidproquo-webserver`](./quidproquo-webserver) | HTTP routing, APIs, services, and web entry points |
| [`quidproquo-web`](./quidproquo-web) | Client-side utilities, OAuth2, and request handling |
| [`quidproquo-web-react`](./quidproquo-web-react) | React hooks, state management (Jotai), and WebSocket support |
| [`quidproquo-deploy-awscdk`](./quidproquo-deploy-awscdk) | AWS CDK constructs and stack definitions for cloud deployment |
| [`quidproquo-deploy-webpack`](./quidproquo-deploy-webpack) | Webpack configuration and plugins for bundling QPQ services |
| [`quidproquo-dev-server`](./quidproquo-dev-server) | Local development server with in-memory cloud service emulation |
| [`quidproquo-testing`](./quidproquo-testing) | Fluent test utilities and Vitest matchers for generator stories |
| [`quidproquo-actionprocessor-awslambda`](./quidproquo-actionprocessors#aws-lambda) | Action processors targeting AWS Lambda and AWS services |
| [`quidproquo-actionprocessor-node`](./quidproquo-actionprocessors#node) | Action processors for general Node.js environments |
| [`quidproquo-actionprocessor-js`](./quidproquo-actionprocessors#js) | Lightweight JavaScript action processors |
| [`quidproquo-actionprocessor-web`](./quidproquo-actionprocessors#web) | Browser-compatible action processors |
| [`quidproquo-config-aws`](./quidproquo-config-aws) | AWS-specific configuration helpers and resource definitions |

## Choosing the Right Packages

**Building a backend API on AWS?**  
Use `quidproquo-webserver` for routing + `quidproquo-actionprocessor-awslambda` for runtime + `quidproquo-deploy-awscdk` for infrastructure.

**Building a React SPA?**  
Use `quidproquo-web-react` for hooks and state + `quidproquo-actionprocessor-web` for browser-side story execution.

**Developing locally without an AWS account?**  
Use `quidproquo-dev-server` to emulate cloud services on your machine.

**Writing unit tests for stories?**  
Use `quidproquo-testing` with its `expectGenerator()` API or Vitest matchers.
