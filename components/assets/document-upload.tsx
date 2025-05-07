"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Trash2, FileText } from "lucide-react"

interface DocumentUploadProps {
  label: string
  helperText?: string
}

export function DocumentUpload({ label, helperText }: DocumentUploadProps) {
  const [files, setFiles] = useState<File[]>([])
  const [fileNames, setFileNames] = useState<string[]>([])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      setFiles([...files, ...newFiles])
      setFileNames([...fileNames, ...newFiles.map((file) => file.name)])
    }
  }

  const removeFile = (index: number) => {
    const newFiles = [...files]
    const newFileNames = [...fileNames]
    newFiles.splice(index, 1)
    newFileNames.splice(index, 1)
    setFiles(newFiles)
    setFileNames(newFileNames)
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {helperText && <p className="text-sm text-muted-foreground">{helperText}</p>}

      <div className="flex items-center gap-2">
        <Input
          type="file"
          className="hidden"
          id={`file-upload-${label.replace(/\s+/g, "-").toLowerCase()}`}
          onChange={handleFileChange}
          multiple
        />
        <Button
          variant="outline"
          onClick={() => {
            document.getElementById(`file-upload-${label.replace(/\s+/g, "-").toLowerCase()}`)?.click()
          }}
          className="w-full"
        >
          <Upload className="mr-2 h-4 w-4" />
          Subir Documento
        </Button>
      </div>

      {fileNames.length > 0 && (
        <div className="space-y-2 mt-2">
          {fileNames.map((name, index) => (
            <div key={index} className="flex items-center justify-between p-2 border rounded-md">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm truncate max-w-[200px]">{name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
