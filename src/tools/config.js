// Tool Configuration
export const toolConfig = {
  core_tools: {
    command_line: { type: 'built_in', agents: ['all'] },
    database: { type: 'built_in', agents: ['all'] }
  },
  rag_tools: {
    document_search: { type: 'langchain', provider: 'chromadb', agents: ['business_analyst', 'technical_writer'] },
    code_search: { type: 'langchain', provider: 'faiss', agents: ['backend_dev', 'frontend_dev'] }
  },
  browser_automation: {
    playwright: { type: 'npm', package: 'playwright', agents: ['frontend_dev', 'qa_engineer'] },
    selenium: { type: 'pip', package: 'selenium', agents: ['qa_engineer'] }
  },
  mcp_servers: {
    figma: { type: 'mcp', server: '@glips/figma-context-mcp', agents: ['ux_designer'] },
    github: { type: 'mcp', server: '@modelcontextprotocol/server-github', agents: ['backend_dev', 'frontend_dev'] }
  }
};
