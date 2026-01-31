/**
 * Real-time performance chart for monitoring expected, elapsed, and time passed
 */
export class PerformanceChart {
  constructor(canvasId, maxDataPoints = 100) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.maxDataPoints = maxDataPoints;
    
    this.lagData = [];
    this.varianceData = [];
    this.labels = [];
    
    // Chart styling
    this.padding = { top: 40, right: 20, bottom: 40, left: 60 };
    this.colors = {
      lag: '#ff6b6b',
      variance: '#4ecdc4',
      grid: '#ddd',
      gridDark: '#444',
      textLight: '#555',
      textDark: '#aaa',
      bgLight: '#ffffff',
      bgDark: '#1a1a1a'
    };
    
    this.isDarkMode = this.checkDarkMode();
    this.setupResizeListener();
    this.resizeCanvas();
  }
  
  checkDarkMode() {
    return document.documentElement.style.colorScheme === 'dark';
  }
  
  setupResizeListener() {
    window.addEventListener('colorscheme-change', () => {
      this.isDarkMode = this.checkDarkMode();
      this.draw();
    });
    
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.draw();
    });
  }
  
  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.ctx.scale(dpr, dpr);
    this.canvasWidth = rect.width;
    this.canvasHeight = rect.height;
  }
  
  addData(lag, timePassed, interval) {
    // Only track metrics that oscillate around 0, not cumulative metrics
    // lag: measured latency in this tick
    // timePassed - interval: deviation of this interval from expected
    const lagValue = lag; // Measured latency
    const varianceValue = timePassed - interval; // Per-interval deviation
    
    this.lagData.push(lagValue);
    this.varianceData.push(varianceValue);
    this.labels.push(this.lagData.length);
    
    if (this.lagData.length > this.maxDataPoints) {
      this.lagData.shift();
      this.varianceData.shift();
      this.labels.shift();
    }
    
    this.draw();
  }
  
  draw() {
    if (this.lagData.length === 0) return;
    
    const isDark = this.isDarkMode;
    const gridColor = isDark ? this.colors.gridDark : this.colors.grid;
    const textColor = isDark ? this.colors.textDark : this.colors.textLight;
    const bgColor = isDark ? this.colors.bgDark : this.colors.bgLight;
    
    // Clear canvas
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    
    // Draw grid
    this.drawGrid(gridColor, textColor);
    
    // Draw axes
    this.drawAxes(textColor);
    
    // Draw data lines
    this.drawLine(this.lagData, this.colors.lag, 'Lag');
    this.drawLine(this.varianceData, this.colors.variance, 'Interval Variance');
    
    // Draw legend
    this.drawLegend(textColor);
  }
  
  drawGrid(gridColor, textColor) {
    const plotWidth = this.canvasWidth - this.padding.left - this.padding.right;
    const plotHeight = this.canvasHeight - this.padding.top - this.padding.bottom;
    
    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 0.5;
    
    // Create grid path using Path2D
    const gridPath = new Path2D();
    
    // Vertical grid lines
    const verticalLines = 5;
    for (let i = 0; i <= verticalLines; i++) {
      const x = this.padding.left + (plotWidth / verticalLines) * i;
      gridPath.moveTo(x, this.padding.top);
      gridPath.lineTo(x, this.canvasHeight - this.padding.bottom);
    }
    
    // Horizontal grid lines
    const horizontalLines = 5;
    for (let i = 0; i <= horizontalLines; i++) {
      const y = this.padding.top + (plotHeight / horizontalLines) * i;
      gridPath.moveTo(this.padding.left, y);
      gridPath.lineTo(this.canvasWidth - this.padding.right, y);
    }
    
    this.ctx.stroke(gridPath);
  }
  
  drawAxes(textColor) {
    this.ctx.strokeStyle = textColor;
    this.ctx.lineWidth = 1.5;
    
    // Create axes path using Path2D
    const axesPath = new Path2D();
    
    // Y-axis
    axesPath.moveTo(this.padding.left, this.padding.top);
    axesPath.lineTo(this.padding.left, this.canvasHeight - this.padding.bottom);
    
    // X-axis
    axesPath.moveTo(this.padding.left, this.canvasHeight - this.padding.bottom);
    axesPath.lineTo(this.canvasWidth - this.padding.right, this.canvasHeight - this.padding.bottom);
    
    this.ctx.stroke(axesPath);
    
    // Y-axis labels and center zero line
    this.ctx.fillStyle = textColor;
    this.ctx.font = '12px sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';
    
    const maxValue = this.getMaxValue();
    const plotHeight = this.canvasHeight - this.padding.top - this.padding.bottom;
    const centerY = this.canvasHeight - this.padding.bottom - (plotHeight / 2);
    
    // Draw center line at 0
    this.ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    
    const centerLinePath = new Path2D();
    centerLinePath.moveTo(this.padding.left, centerY);
    centerLinePath.lineTo(this.canvasWidth - this.padding.right, centerY);
    this.ctx.stroke(centerLinePath);
    
    this.ctx.setLineDash([]);
    this.ctx.strokeStyle = textColor;
    this.ctx.lineWidth = 1.5;
    
    // Y-axis labels (from -maxValue to +maxValue)
    for (let i = 0; i <= 5; i++) {
      const value = (maxValue / 5) * i - maxValue / 2;
      const y = this.canvasHeight - this.padding.bottom - (plotHeight / 5) * i;
      this.ctx.fillText(value.toFixed(1), this.padding.left - 10, y);
    }
    
    // X-axis label
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('Sample', this.canvasWidth / 2, this.canvasHeight - 10);
    
    // Y-axis label
    this.ctx.save();
    this.ctx.translate(15, this.canvasHeight / 2);
    this.ctx.rotate(-Math.PI / 2);
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Offset (ms)', 0, 0);
    this.ctx.restore();
  }
  
  drawLine(data, color, label) {
    if (data.length === 0) return;
    
    const plotWidth = this.canvasWidth - this.padding.left - this.padding.right;
    const plotHeight = this.canvasHeight - this.padding.top - this.padding.bottom;
    const maxValue = this.getMaxValue();
    const centerY = this.canvasHeight - this.padding.bottom - (plotHeight / 2);
    
    // Create line path using Path2D
    const linePath = new Path2D();
    
    for (let i = 0; i < data.length; i++) {
      const x = this.padding.left + (plotWidth / (data.length - 1 || 1)) * i;
      // Normalize value to be centered around 0, ranging from -maxValue to +maxValue
      const normalizedValue = (data[i] / maxValue) * (plotHeight / 2);
      const y = centerY - normalizedValue;
      
      if (i === 0) {
        linePath.moveTo(x, y);
      } else {
        linePath.lineTo(x, y);
      }
    }
    
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.stroke(linePath);
  }
  
  drawLegend(textColor) {
    const legendX = this.canvasWidth - 150;
    const legendY = this.padding.top + 10;
    const lineHeight = 18;
    
    this.ctx.fillStyle = textColor;
    this.ctx.font = 'bold 13px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.lineWidth = 2;
    
    // Create legend lines path using Path2D
    const legendPath = new Path2D();
    
    // Lag legend line
    legendPath.moveTo(legendX, legendY);
    legendPath.lineTo(legendX + 15, legendY);
    
    // Interval Variance legend line
    legendPath.moveTo(legendX, legendY + lineHeight);
    legendPath.lineTo(legendX + 15, legendY + lineHeight);
    
    // Draw lag legend line
    this.ctx.strokeStyle = this.colors.lag;
    this.ctx.stroke(legendPath);
    
    this.ctx.fillText('Lag', legendX + 20, legendY);
    
    // Draw variance legend line
    this.ctx.strokeStyle = this.colors.variance;
    this.ctx.stroke(legendPath);
    
    this.ctx.fillText('Interval Variance', legendX + 20, legendY + lineHeight);
  }
  
  getMaxValue() {
    let max = 1;
    
    if (this.lagData.length > 0) {
      const lagMax = Math.max(...this.lagData.map(v => Math.abs(v)));
      max = Math.max(max, lagMax);
    }
    
    if (this.varianceData.length > 0) {
      const varianceMax = Math.max(...this.varianceData.map(v => Math.abs(v)));
      max = Math.max(max, varianceMax);
    }
    
    // Round up to nearest 10
    return Math.max(Math.ceil(max / 10) * 10, 10);
  }
  
  clear() {
    this.lagData = [];
    this.varianceData = [];
    this.labels = [];
    
    const isDark = this.isDarkMode;
    const bgColor = isDark ? this.colors.bgDark : this.colors.bgLight;
    
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
  }
  
  getStats() {
    if (this.lagData.length === 0) {
      return { avgLag: 0, avgVariance: 0 };
    }
    
    const avgLag = this.lagData.reduce((a, b) => a + b) / this.lagData.length;
    const avgVariance = this.varianceData.reduce((a, b) => a + b) / this.varianceData.length;
    
    return { avgLag, avgVariance };
  }
}
