
export const trackGeminiUsage = (model: string, inputTokens: number, outputTokens: number) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const stored = localStorage.getItem('gemini_usage_today');
  
  // Pricing per 1M tokens (USD) - Gemini 1.5 Flash (Estimated average)
  // Input: $0.075 / 1M | Output: $0.30 / 1M
  const inputPrice = 0.000000075; 
  const outputPrice = 0.00000030;
  
  const costUSD = (inputTokens * inputPrice) + (outputTokens * outputPrice);

  if (stored) {
    const data = JSON.parse(stored);
    if (data.date === todayStr) {
      data.count += 1;
      data.tokens = (data.tokens || 0) + inputTokens + outputTokens;
      data.costUSD = (data.costUSD || 0) + costUSD;
      localStorage.setItem('gemini_usage_today', JSON.stringify(data));
    } else {
      localStorage.setItem('gemini_usage_today', JSON.stringify({ 
        date: todayStr, 
        count: 1, 
        tokens: inputTokens + outputTokens,
        costUSD: costUSD
      }));
    }
  } else {
    localStorage.setItem('gemini_usage_today', JSON.stringify({ 
      date: todayStr, 
      count: 1, 
      tokens: inputTokens + outputTokens,
      costUSD: costUSD
    }));
  }
};
