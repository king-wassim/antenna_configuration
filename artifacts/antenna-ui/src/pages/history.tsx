import React from "react";
import { Link } from "wouter";
import { useListPredictions, useDeletePrediction, getListPredictionsQueryKey, getGetRecentHistoryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, ExternalLink } from "lucide-react";

export default function History() {
  const { data: predictions, isLoading } = useListPredictions();
  const deleteMutation = useDeletePrediction();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const formatConfig = (c: any) => `[${c.ring1}, ${c.ring2}, ${c.ring3}, ${c.ring4}, ${c.ring5}]`;

  const handleDelete = (id: number) => {
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPredictionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetRecentHistoryQueryKey() });
        toast({ title: "Deleted record successfully." });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Prediction History</h1>
        <p className="text-muted-foreground mt-1">Log of all AI layout comparisons.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Records</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !predictions?.length ? (
            <div className="py-12 text-center text-muted-foreground">
              No history found. Run a comparison to save data.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Angle</TableHead>
                  <TableHead>Ref Config</TableHead>
                  <TableHead>Pred Config</TableHead>
                  <TableHead className="text-right">Global Err</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {predictions.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-muted-foreground">{p.id}</TableCell>
                    <TableCell>{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{p.theta0Deg}°</TableCell>
                    <TableCell className="font-mono text-xs">{formatConfig(p.referenceConfig)}</TableCell>
                    <TableCell className="font-mono text-xs">{formatConfig(p.predictedConfig)}</TableCell>
                    <TableCell className="text-right font-mono text-primary font-bold">
                      {p.globalError.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/history/${p.id}`}>
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:bg-destructive/20"
                          onClick={() => handleDelete(p.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
