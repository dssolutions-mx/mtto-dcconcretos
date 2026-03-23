# Maintenance Dashboard

A comprehensive maintenance management system built with Next.js, Supabase, and TypeScript.

## 🎉 Latest Feature: Checklist Template Versioning

### ✅ **NEWLY IMPLEMENTED - Phase 2 & 3 Complete**

The system now includes **enterprise-grade checklist template versioning** with:

- **🔧 Template Editor**: Real-time editing interface with live preview
- **📋 Version Management**: Immutable history with visual comparison tools
- **🔄 Offline Compatible**: 100% backward compatibility with enhanced capabilities
- **🧪 QA Testing**: Comprehensive testing framework included

**🚀 Test the new features**: Visit `/test-versioning` to explore all capabilities

---

## Features

### Equipment Management
- Asset registration and tracking
- Model specifications and maintenance intervals
- Production report generation
- Asset lifecycle management

### Maintenance Operations
- **Daily Checklists**: ✅ *Now with versioning support*
- Incident reporting with evidence upload
- Work order management and tracking
- Calendar-based maintenance scheduling

### Procurement System
- Purchase request workflows
- Approval processes with notifications
- Inventory management
- Cost tracking and reporting

### Historical Records
- Comprehensive maintenance history
- Service order tracking
- Reports and analytics
- Audit trails

### **🆕 Template Versioning System**
- **Template Editor**: Edit checklists with real-time preview
- **Version History**: Track all changes with immutable snapshots
- **Visual Comparison**: See differences between any two versions
- **One-Click Restore**: Instantly revert to previous versions
- **Offline Support**: Works seamlessly offline with smart sync

## Technology Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **UI/UX**: Tailwind CSS, shadcn/ui components
- **State Management**: React hooks and context
- **Offline Support**: Custom offline service with IndexedDB

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd maintenance-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Add your Supabase credentials
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **🧪 Test new versioning features**
   ```
   Visit: http://localhost:3000/test-versioning
   ```

## New Versioning Features

### Template Editor
- Real-time editing with live preview
- Section and item management
- Validation and error handling
- Change tracking and documentation

### Version Management
- Complete version history
- Visual diff between versions
- One-click restoration
- Audit trail preservation

### Offline Enhancement
- Version-aware caching
- Smart sync detection
- Automatic legacy upgrade
- 100% backward compatibility

## Project Structure

```
maintenance-dashboard/
├── app/                     # Next.js app router
│   ├── (auth)/             # Authentication pages
│   ├── (dashboard)/        # Main dashboard
│   ├── activos/            # Asset management
│   ├── checklists/         # ✨ Enhanced with versioning
│   ├── api/                # API routes
│   └── test-versioning/    # 🆕 Testing interface
├── components/             # Reusable components
│   ├── checklists/         # ✨ New versioning components
│   ├── ui/                 # UI components
│   └── ...
├── lib/                    # Utilities and services
│   ├── services/           # ✨ Enhanced offline service
│   └── ...
└── types/                  # ✨ Updated TypeScript types
```

## Documentation

- **Roles, POL-OPE-001/002, and enforcement index:** [`docs/sops/roles/INDEX.md`](docs/sops/roles/INDEX.md) — policy traceability, DB role mapping, web/API inventory, HTML matrix cross-reference.
- **Canonical policy copies (v2.0):** [`docs/sops/policies/`](docs/sops/policies/) — see [`VERSIONS.md`](docs/sops/policies/VERSIONS.md).
- **Current writeups:** [`docs/`](docs/) — PO/inventory workflow, Supabase notes, security phases, active plans under [`docs/plans/`](docs/plans/).
- **Legacy root markdown** (old implementation summaries and guides): [`docs/archive/root-md/`](docs/archive/root-md/).
- **Database workflow:** [`docs/DATABASE_MIGRATIONS.md`](docs/DATABASE_MIGRATIONS.md) (MCP / CLI; archived SQL under `archive/legacy-db-migrations/`).
- **Data / PDFs / stray media** (imports, policies, screenshots): [`archive/`](archive/README.md) — see [`archive/README.md`](archive/README.md).
- **Where to put new files (agents & humans):** [`docs/skills/repo-structure-hygiene/SKILL.md`](docs/skills/repo-structure-hygiene/SKILL.md).

## Database Schema

The system uses Supabase with a comprehensive PostgreSQL schema including:

- **Core Tables**: Assets, work orders, checklists, users
- **🆕 Versioning Tables**: `checklist_template_versions` with JSONB snapshots
- **🆕 Database Functions**: Version creation, restoration, and management
- **Security**: Row Level Security (RLS) policies

## API Documentation

### Core Endpoints
- `/api/assets/*` - Asset management
- `/api/maintenance/*` - Maintenance operations
- `/api/checklists/*` - Checklist management

### **🆕 Versioning Endpoints**
- `POST /api/checklists/templates/create-version` - Create new version
- `POST /api/checklists/templates/restore-version` - Restore version

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation in `/docs`
- **🆕 Use the QA testing panel** at `/test-versioning` for troubleshooting

---

**🎉 Template Versioning System - Production Ready!** 