# Contributing to Debo

First off, thank you for considering contributing to Debo! It's people like you that make Debo such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps to reproduce the problem**
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed after following the steps**
* **Explain which behavior you expected to see instead and why**
* **Include screenshots and animated GIFs if possible**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a step-by-step description of the suggested enhancement**
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior and explain which behavior you expected**
* **Explain why this enhancement would be useful**

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Include screenshots and animated GIFs in your pull request whenever possible
* Follow the JavaScript styleguide
* Include thoughtfully-worded, well-structured tests
* Document new code
* End all files with a newline

## Development Process

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Setting Up Your Development Environment

```bash
# Clone your fork
git clone https://github.com/Kevin-Kurka/Debo.git
cd debo

# Install dependencies
npm install

# Set up development environment
npm run setup:dev

# Run tests
npm test

# Run linting
npm run lint
```

## Styleguides

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

### JavaScript Styleguide

* 2 spaces for indentation
* No unused variables
* Space after keywords
* Space before function parenthesis
* Always use `===` instead of `==`
* Always handle errors

### Agent Development

When creating new agents:

1. Add agent configuration to `src/agents/roles.js`
2. Implement agent logic following existing patterns
3. Add appropriate tests
4. Update documentation
5. Consider the agent's interaction with other agents

### Testing

* Write tests for all new functionality
* Ensure all tests pass before submitting PR
* Aim for >80% code coverage
* Use descriptive test names

## Project Structure

```
debo/
├── src/
│   ├── agents/         # Agent definitions and logic
│   ├── core/           # Core orchestration
│   ├── database/       # Database managers
│   ├── infrastructure/ # LLM and infrastructure
│   └── tools/          # Tool implementations
├── tests/              # Test files
├── docs/               # Documentation
└── scripts/            # Build and utility scripts
```

## Need Help?

Feel free to ask questions in:
* GitHub Discussions
* Issues (for bugs/features)
* Community Discord (coming soon)

## Recognition

Contributors will be recognized in:
* README.md contributors section
* Release notes
* Project website (coming soon)

Thank you for contributing to Debo! 🎉