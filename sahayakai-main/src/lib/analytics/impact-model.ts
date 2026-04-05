import { logger } from '../logger';

export interface RawScores {
  activity: number;
  engagement: number;
  success: number;
  growth: number;
}

export interface ImpactModelConfig {
  weights: {
    activity: number;
    engagement: number;
    success: number;
    growth: number;
  };
  baselineCurrent: number; // Beta constant
}

/**
 * State-of-the-Art Impact Dashboard Modeling Engine
 * Translates raw continuous vectors into a probabilistically bounded [0, 100] scale.
 */
export class ImpactModelingEngine {
  private config: ImpactModelConfig;

  constructor(config?: Partial<ImpactModelConfig>) {
    this.config = {
      weights: config?.weights || {
        activity: 1.2,
        engagement: 1.0,
        success: 0.8,
        growth: 1.3
      },
      baselineCurrent: config?.baselineCurrent || 60, // Centers the sigmoid mapping
    };
  }

  /**
   * Sigmoid Activation Mapping
   * Translates an unbounded real number x to a bounded range [0, 100].
   */
  private sigmoid(x: number): number {
    return 100 / (1 + Math.exp(-x));
  }

  /**
   * Calculate global fluid health score combining 4 orthogonal domains.
   */
  public calculateFluidHealth(metrics: RawScores): number {
    const { activity, engagement, success, growth } = metrics;
    
    // Convert 100-max sub-scores back to standard weights
    const z_A = (activity / 100) * this.config.weights.activity;
    const z_E = (engagement / 100) * this.config.weights.engagement;
    const z_S = (success / 100) * this.config.weights.success;
    const z_G = (growth / 100) * this.config.weights.growth;

    // Sum weighted linear domain scores minus the baseline barrier
    const z_total = z_A + z_E + z_S + z_G - (this.config.baselineCurrent / 100);

    // Multiply by dynamic scalar mapping (so max score doesn't cap early)
    // We adjust the sigmoid curve to sit elegantly over the 0-100 threshold
    // Scale input to [-3, 3] roughly
    const scaled_z = (z_total - 1.5) * 2; 

    return Math.round(this.sigmoid(scaled_z));
  }

  /**
   * Determine the probabilistic risk category
   * $P(\text{churn}) = 1 - \frac{H(t)}{100}$
   */
  public calculateRiskCategory(healthScore: number): 'healthy' | 'at-risk' | 'critical' {
    const pChurn = 1 - (healthScore / 100);
    
    if (pChurn < 0.3) return 'healthy';
    if (pChurn <= 0.6) return 'at-risk';
    return 'critical';
  }
}
