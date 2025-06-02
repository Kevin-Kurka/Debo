# Truth-Finding System Documentation

## Overview

The Debo Truth-Finding System is an advanced claim verification framework that uses three specialized AI agents working in concert to evaluate claims, arguments, and source credibility using legal evidence standards similar to court discovery rules.

## Architecture

### Three Specialized Agents

1. **Truth Seeker Agent** (`truth_seeker`)
   - Primary source verification specialist
   - Operates under strict Federal Rules of Evidence standards
   - Rejects hearsay and unverifiable claims
   - Demands original documents and direct testimony
   - Provides confidence scores (0-100) for each claim

2. **Trial by Fire Agent** (`trial_by_fire`)
   - Adversarial analysis expert
   - Arguments BOTH sides of every issue with equal vigor
   - Acts like an attorney presenting prosecution AND defense
   - Scores arguments objectively (0-100)
   - Declares winner based on evidence weight

3. **Credibility Agent** (`credibility_agent`)
   - Source reliability assessment specialist
   - Scores credibility on 1-100 scale
   - Detects hypocrisies and inconsistencies
   - Analyzes author track records
   - Identifies conflicts of interest

### Evidence Standards

The system implements legal evidence standards based on Federal Rules of Evidence:

- **Relevance**: Evidence must make facts more or less probable
- **Hearsay Rules**: Out-of-court statements generally rejected
- **Authentication**: Sufficient proof that evidence is genuine
- **Best Evidence Rule**: Original documents preferred over copies
- **Expert Testimony**: Must meet Daubert standards

### Burden of Proof Levels

- **Preponderance of Evidence** (>50%): More likely than not
- **Clear and Convincing** (>75%): Highly probable
- **Beyond Reasonable Doubt** (>95%): No reasonable doubt

## Usage

### MCP Tool Interface

The truth-finding system is exposed as an MCP tool called `truth_investigate`:

```json
{
  "name": "truth_investigate",
  "inputSchema": {
    "type": "object",
    "properties": {
      "claim": {
        "type": "string",
        "description": "The claim or statement to investigate"
      },
      "type": {
        "type": "string",
        "enum": ["general", "political", "scientific", "legal"],
        "description": "Type of investigation"
      },
      "sources": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Optional list of sources to evaluate"
      },
      "context": {
        "type": "object",
        "description": "Additional context"
      }
    },
    "required": ["claim"]
  }
}
```

### Example Usage

#### General Claim Investigation
```javascript
{
  "claim": "Climate change is primarily caused by human activities",
  "type": "general"
}
```

#### Political Statement Verification
```javascript
{
  "claim": "The unemployment rate has decreased",
  "type": "political",
  "sources": ["President Biden", "Bureau of Labor Statistics Report 2024"]
}
```

#### Scientific Claim Analysis
```javascript
{
  "claim": "New drug XYZ cures cancer",
  "type": "scientific",
  "sources": ["Journal of Medicine 2024", "Clinical Trial NCT12345"]
}
```

#### Legal Dispute Evaluation
```javascript
{
  "claim": "The contract was breached",
  "type": "legal",
  "sources": ["Contract dated 2023-01-01", "Email correspondence"],
  "context": { "jurisdiction": "New York State" }
}
```

## Investigation Process

1. **Claim Analysis**: CTO agent analyzes the claim and delegates to truth-finding agents
2. **Primary Source Verification**: Truth Seeker examines evidence and sources
3. **Adversarial Analysis**: Trial by Fire argues both sides of the claim
4. **Credibility Assessment**: Credibility Agent evaluates source reliability
5. **Synthesis**: Final verdict combines all three analyses with weighted scoring

## Output Format

The investigation produces a comprehensive report including:

- **Verdict**: Clear conclusion with confidence level
- **Evidence Analysis**: Admissible vs. rejected evidence
- **Component Scores**: Individual scores from each agent
- **Key Findings**: Bullet-point summary of discoveries
- **Issues Identified**: Problems with evidence or sources
- **Recommendations**: Suggestions for stronger evidence

## Redis State Management

All investigation data is stored in Redis with the following key patterns:

- `investigation:{id}`: Core investigation metadata
- `investigation:{id}:truth_analysis`: Truth Seeker results
- `investigation:{id}:debate_analysis`: Trial by Fire results
- `investigation:{id}:credibility_analysis`: Credibility Agent results
- `investigation:{id}:final_report`: Complete investigation report
- `investigation_log`: List of all investigations

## Quality Assurance

The system includes several quality checks:

1. **Evidence Validation**: All evidence must meet admissibility standards
2. **Source Authentication**: Sources must be verifiable
3. **Logical Consistency**: Arguments must be internally consistent
4. **Bias Detection**: Identifies potential biases in sources
5. **Circular Reasoning**: Detects claims that depend on themselves

## Best Practices

1. **Be Specific**: Provide clear, specific claims rather than vague statements
2. **Include Sources**: The more sources provided, the better the analysis
3. **Use Appropriate Type**: Select the correct investigation type for best results
4. **Provide Context**: Additional context helps agents understand the claim
5. **Primary Sources**: Link to original documents when possible

## Limitations

- Cannot access real-time internet data (unless web tools are configured)
- Limited to text-based evidence analysis
- Requires clear, well-defined claims
- May timeout on extremely complex investigations
- Subject to the quality of provided sources

## Integration with Fortune 500 System

The truth-finding agents integrate seamlessly with the existing Fortune 500 agent structure:

- Uses the same LLM provider system (thinking LLMs for all three agents)
- Follows the same task management patterns
- Integrates with the unified orchestrator
- Supports the same monitoring and logging systems
- Compatible with existing quality gateways

## Future Enhancements

- Real-time web scraping for source verification
- Integration with fact-checking databases
- Support for multimedia evidence (images, videos)
- Automated source discovery
- Blockchain evidence authentication
- Multi-language support
- Historical claim tracking