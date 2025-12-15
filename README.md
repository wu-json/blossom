# Blossom 🌸

Blossom is an AI conversational language learning app, designed to help you practice Japanese, Chinese, and Korean through natural dialogue. It compiles to a single binary and runs locally in your browser.

## Installation

```bash
brew tap wu-json/asahi
brew install blossom

# run blossom server
blossom
```

## Configuration

| Environment Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (required) | - |
| `BLOSSOM_DATA_DIR` | Directory for data storage | `~/.blossom` |

## Design Philosophy

Blossom focuses on immersive language practice through conversation rather than traditional drills. The AI tutor adapts to your level and provides natural corrections and explanations in context.

## Development

This project uses [aqua](https://aquaproj.github.io/) for package management and [curse](https://github.com/wu-json/curse) for running local development processes.

To start the development environment:

```bash
curse
```
