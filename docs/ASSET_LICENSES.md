# 아이콘과 자산 이름

확인일: 2026-10-16

자산 32개와 그룹은 제품/역할 이름과 설명 데이터다. 현재 앱은 제품 공식 로고를 배포하지 않고 `lucide-react` 1.18.0의 일반 아이콘(Database, Container, Server, Cloud 등)을 재사용한다. 특정 공급자의 공식 다이어그램 아이콘이나 승인 표시로 해석하지 않는다.

- 출처: 설치된 `node_modules/lucide-react/LICENSE`, 패키지 저장소 https://github.com/lucide-icons/lucide
- Lucide: ISC License. 일부 아이콘은 Feather에서 유래하며 패키지 LICENSE에 해당 목록과 MIT License가 포함되어 있다.
- 패키지에 포함된 원문 전체를 [licenses/lucide.txt](licenses/lucide.txt)에 보존했다. 제품 이름의 상표 권리는 각 소유자에게 있다.
- Phase 5 추가 자산은 MySQL/SQLite, Kubernetes/Linux, API Gateway/Kafka, FastAPI/Next.js, AWS EC2/S3/Lambda, Azure Storage다. 기존 자산 ID는 변경하지 않았다.

공식 브랜드 아이콘을 나중에 도입할 때는 해당 공급자의 재배포/색상/변형 규칙을 별도로 확인한다. 현재 데이터/일반 아이콘 매핑은 `src/data/assets.ts`, `src/utils/assetPresentation.ts`에서 관리한다.
