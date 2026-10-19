
"use client";

import { useEffect, useState } from "react";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCcw, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { getN11Tasks } from "../actions";
import { Button } from "@/components/ui/button";

export function N11TaskHistory() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadTasks = async () => {
        setLoading(true);
        try {
            const data = await getN11Tasks();
            setTasks(data);
        } catch (error) {
            console.error("Tasks load error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTasks();
    }, []);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "COMPLETED":
                return <Badge className="bg-green-100 text-green-700 border-none"><CheckCircle2 className="w-3 h-3 mr-1" /> Başarılı</Badge>;
            case "FAILED":
                return <Badge className="bg-red-100 text-red-700 border-none"><AlertCircle className="w-3 h-3 mr-1" /> Hata</Badge>;
            default:
                return <Badge className="bg-amber-100 text-amber-700 border-none"><Clock className="w-3 h-3 mr-1 animate-pulse" /> Kuyrukta</Badge>;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
                <h3 className="text-sm font-semibold text-gray-500">Son 50 İşlem Kaydı</h3>
                <Button variant="ghost" size="sm" onClick={loadTasks} disabled={loading} className="text-purple-600">
                    <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Yenile
                </Button>
            </div>

            <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-gray-50/50 dark:bg-gray-800/50">
                        <TableRow>
                            <TableHead>Tarih</TableHead>
                            <TableHead>Ürün</TableHead>
                            <TableHead>Task ID</TableHead>
                            <TableHead>Durum</TableHead>
                            <TableHead>N11 Mesajı</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10">
                                    <RefreshCcw className="w-6 h-6 animate-spin mx-auto text-purple-400" />
                                </TableCell>
                            </TableRow>
                        ) : tasks.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                                    Henüz işlem kaydı bulunamadı.
                                </TableCell>
                            </TableRow>
                        ) : (
                            tasks.map((task) => (
                                <TableRow key={task.id} className="hover:bg-gray-50/50 transition-colors">
                                    <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap">
                                        {new Date(task.createdAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}
                                    </TableCell>
                                    <TableCell className="font-medium text-xs max-w-[200px] truncate">
                                        {task.n11Product?.product?.name || "Bilinmeyen Ürün"}
                                    </TableCell>
                                    <TableCell className="font-mono text-[10px] text-gray-400">
                                        {task.taskId}
                                    </TableCell>
                                    <TableCell>
                                        {getStatusBadge(task.status)}
                                    </TableCell>
                                    <TableCell className="text-[11px] text-red-500 max-w-[300px]">
                                        {task.errorMessage || "-"}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
