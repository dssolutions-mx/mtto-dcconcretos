"use client"

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

type CommonIssue = {
  item_id: string
  item_description: string
  section_title: string
  checklist_name: string
  issue_count: number
}

export function CommonIssuesTable({ issues }: { issues: CommonIssue[] }) {
  if (!issues || issues.length === 0) {
    return <div className="text-center py-10">No se encontraron problemas recurrentes</div>
  }
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Descripción del Problema</TableHead>
          <TableHead>Sección</TableHead>
          <TableHead>Checklist</TableHead>
          <TableHead className="text-right">Ocurrencias</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {issues.map(issue => (
          <TableRow key={issue.item_id}>
            <TableCell className="font-medium">{issue.item_description}</TableCell>
            <TableCell>{issue.section_title}</TableCell>
            <TableCell>{issue.checklist_name}</TableCell>
            <TableCell className="text-right">
              <Badge variant={issue.issue_count > 5 ? "destructive" : "default"}>
                {issue.issue_count}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
} 