# Blossom 🌸

Blossom is an AI conversational language learning app, designed to help you practice Japanese, Chinese, and Korean through natural dialogue. It compiles to a single binary and runs locally.

<img width="1119" height="1397" alt="スクリーンショット 2025-12-14 午後7 16 21" src="https://github.com/user-attachments/assets/63f4de6c-e0d1-4f80-996e-9091523c2de4" />

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
| `BLOSSOM_DIR` | Directory for data storage | `~/.blossom` |

## Development

This project uses [aqua](https://aquaproj.github.io/) for package management and [curse](https://github.com/wu-json/curse) for running local development processes.

To start the development environment:

```bash
# build embeddings
just build

# start dev servers
curse
```
