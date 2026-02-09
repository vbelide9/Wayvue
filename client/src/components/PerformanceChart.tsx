import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

interface PerformanceChartProps {
    data: any[];
    title: string;
    description?: string;
    metrics: { key: string; color: string; name: string }[];
    type?: 'line' | 'bar';
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, title, description, metrics, type = 'line' }) => {
    return (
        <div className="col-span-1 bg-card text-card-foreground rounded-xl border border-border shadow-sm">
            <div className="flex flex-col space-y-1.5 p-6">
                <h3 className="font-semibold leading-none tracking-tight">{title}</h3>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            <div className="p-6 pt-0">
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        {type === 'line' ? (
                            <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                                <XAxis
                                    dataKey="time"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                    itemStyle={{ color: '#f3f4f6' }}
                                    labelStyle={{ color: '#9ca3af' }}
                                />
                                <Legend />
                                {metrics.map((m) => (
                                    <Line
                                        key={m.key}
                                        type="monotone"
                                        dataKey={m.key}
                                        stroke={m.color}
                                        strokeWidth={2}
                                        dot={false}
                                        name={m.name}
                                        activeDot={{ r: 6 }}
                                    />
                                ))}
                            </LineChart>
                        ) : (
                            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                                <XAxis
                                    dataKey="name"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: '#374151', opacity: 0.4 }}
                                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                                    itemStyle={{ color: '#f3f4f6' }}
                                    labelStyle={{ color: '#9ca3af' }}
                                />
                                <Legend />
                                {metrics.map((m) => (
                                    <Bar
                                        key={m.key}
                                        dataKey={m.key}
                                        fill={m.color}
                                        name={m.name}
                                        radius={[4, 4, 0, 0]}
                                    />
                                ))}
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
