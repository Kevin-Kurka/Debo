// Agent Configuration with LLM Requirements and Deliverables
export const agentConfig = {
  // THINKING LLM ROLES
  cto: {
    llmType: 'thinking',
    deliverables: {
      code: null,
      database: ['project_strategy', 'technology_decisions', 'resource_allocation'],
      outputs: ['strategic_roadmap', 'architecture_approval', 'budget_allocation']
    },
    instructions: 'Analyze requests strategically. Consider technical feasibility, business impact, resource requirements. Delegate appropriately.'
  },

  engineering_manager: {
    llmType: 'thinking', 
    deliverables: {
      code: null,
      database: ['sprint_plans', 'team_assignments', 'capacity_planning', 'milestone_tracking'],
      outputs: ['sprint_backlog', 'team_allocation', 'delivery_timeline']
    },
    instructions: 'Coordinate teams and resources. Balance workload, manage dependencies, ensure delivery timelines.'
  },

  product_manager: {
    llmType: 'thinking',
    deliverables: {
      code: null,
      database: ['feature_priorities', 'user_stories', 'acceptance_criteria', 'release_planning'],
      outputs: ['product_roadmap', 'feature_specifications', 'priority_matrix']
    },
    instructions: 'Break down features into actionable requirements. Prioritize based on business value and user impact.'
  },

  business_analyst: {
    llmType: 'thinking',
    deliverables: {
      code: null,
      database: ['requirements', 'user_stories', 'acceptance_criteria', 'process_flows'],
      outputs: ['requirement_docs', 'user_story_maps', 'process_diagrams']
    },
    instructions: 'Gather detailed requirements. Define clear acceptance criteria. Map user journeys and business processes.'
  },

  solution_architect: {
    llmType: 'thinking',
    deliverables: {
      code: ['architecture_diagrams', 'api_specifications'],
      database: ['system_design', 'tech_stack_decisions', 'integration_patterns'],
      outputs: ['technical_specs', 'api_contracts', 'deployment_architecture']
    },
    instructions: 'Design scalable systems. Define technical standards. Plan integrations and data flows.'
  },

  technical_writer: {
    llmType: 'thinking',
    deliverables: {
      code: ['documentation', 'api_docs', 'user_guides'],
      database: ['documentation_status', 'content_inventory'],
      outputs: ['technical_documentation', 'user_manuals', 'api_reference']
    },
    instructions: 'Create clear, comprehensive documentation. Ensure technical accuracy and user accessibility.'
  },

  // FAST EXECUTION ROLES
  backend_dev: {
    llmType: 'fast',
    deliverables: {
      code: ['api_endpoints', 'database_models', 'business_logic', 'unit_tests'],
      database: ['code_commits', 'test_coverage', 'api_documentation'],
      outputs: ['working_api', 'database_schema', 'backend_tests']
    },
    instructions: 'Implement API endpoints per specifications. Follow coding standards. Write comprehensive tests. Update API documentation.'
  },

  frontend_dev: {
    llmType: 'fast',
    deliverables: {
      code: ['ui_components', 'client_logic', 'responsive_layouts', 'integration_tests'],
      database: ['ui_test_results', 'accessibility_compliance', 'performance_metrics'],
      outputs: ['working_ui', 'component_library', 'frontend_tests']
    },
    instructions: 'Build responsive UI components per designs. Implement client-side logic. Ensure accessibility and performance.'
  },

  qa_engineer: {
    llmType: 'fast',
    deliverables: {
      code: ['test_scripts', 'automation_tests', 'performance_tests'],
      database: ['test_results', 'bug_reports', 'coverage_metrics', 'quality_gates'],
      outputs: ['test_reports', 'quality_metrics', 'regression_suite']
    },
    instructions: 'Execute test plans thoroughly. Report bugs with clear reproduction steps. Maintain automation suites.'
  },

  devops: {
    llmType: 'fast',
    deliverables: {
      code: ['deployment_scripts', 'infrastructure_code', 'monitoring_configs'],
      database: ['deployment_status', 'infrastructure_metrics', 'environment_configs'],
      outputs: ['live_environments', 'ci_cd_pipelines', 'monitoring_dashboards']
    },
    instructions: 'Deploy applications reliably. Monitor system health. Maintain infrastructure as code.'
  },

  security: {
    llmType: 'fast', 
    deliverables: {
      code: ['security_tests', 'compliance_checks'],
      database: ['security_scan_results', 'vulnerability_reports', 'compliance_status'],
      outputs: ['security_clearance', 'vulnerability_assessment', 'compliance_report']
    },
    instructions: 'Scan for vulnerabilities. Verify security requirements. Ensure compliance with standards.'
  },

  ux_designer: {
    llmType: 'fast',
    deliverables: {
      code: ['design_tokens', 'style_guides'],
      database: ['design_decisions', 'user_research_findings', 'usability_metrics'],
      outputs: ['ui_mockups', 'design_system', 'user_flows']
    },
    instructions: 'Create intuitive user interfaces. Conduct usability testing. Maintain design consistency.'
  },

  dependency_analyst: {
    llmType: 'thinking',
    deliverables: {
      code: ['documentation_index', 'compatibility_matrix'],
      database: ['dependency_documentation', 'compatibility_checks', 'deprecation_warnings'],
      outputs: ['approval_decision', 'migration_plan', 'best_practices_guide']
    },
    instructions: 'Review dependencies for compatibility, security, deprecation. Index documentation. Reject incompatible packages and provide alternatives.'
  }
};

// Database Update Patterns
export const databasePatterns = {
  thinking_roles: {
    update_frequency: 'milestone_based',
    data_types: ['strategic_decisions', 'planning_documents', 'approval_workflows'],
    trigger_events: ['project_start', 'milestone_review', 'scope_change']
  },
  
  execution_roles: {
    update_frequency: 'task_completion',
    data_types: ['work_artifacts', 'test_results', 'deployment_status'],
    trigger_events: ['task_complete', 'code_commit', 'deployment_success']
  }
};
