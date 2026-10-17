# Evidências do catálogo

Capturas verificadas em **17/10/2026** para a [fase 4](../README.md). São amostras de pesquisa; não alimentam o frontend e não constituem banco, integração ou publicação de indicadores.

## Arquivos

| Artefato | Conteúdo e limite |
|---|---|
| [manifest.json](manifest.json) | URL, coleta, status HTTP, tamanho e SHA-256 do corpo recebido, artefato e transformação aplicada |
| `ibge-*.json` | Respostas da API oficial, decodificadas e reformatadas; valores e símbolos preservados como strings |
| `bcb-*.json` | Respostas SGS desde jan/2012 na janela consultada; mudança mensal do mínimo em 2023 em arquivo próprio |
| [metadata.json](metadata.json) | Extratos de tabelas/variáveis/classificações IBGE e fichas CKAN de VF1/VF2, incluindo licenças declaradas |
| [files.json](files.json) | Células de ANP, FJP e SIS; Tabela 1 de dois boletins Conab/DIEESE; histórico/células Ipea |

O hash `response_sha256` é do corpo após descompressão HTTP, antes de decodificar/reformatar JSON. `artifact_sha256` é do arquivo local final. Eles podem diferir mesmo quando os dados são iguais. O manifesto não inclui seu próprio hash. Capturas sem artefato identificam documentos lidos, sem copiar integralmente seus PDFs. Várias capturas podem sustentar o mesmo extrato local.

Quando a requisição tinha timestamp registrado, ele foi preservado; nas demais, `retrieved_at` usa o momento da gravação do download local, em UTC. Não é a data de divulgação da fonte. URLs de arquivos acumulados podem devolver bytes diferentes no futuro; o hash identifica a versão examinada e não promete reproduzir uma edição passada pela rede.

Os XLS da SIS foram convertidos para XLSX em diretório temporário por LibreOffice, somente para leitura das células e notas. O manifesto mantém hash do ZIP original e `files.json` mantém também o hash do membro XLS. Os recortes não são os arquivos brutos completos e não certificam fórmulas ou recursos da planilha. PDFs foram lidos por extração de texto e conferência da tabela original.

## Reproduzir a conferência local

Na raiz do repositório, sem rede ou dependências adicionais:

```sh
python3 - <<'PY'
from pathlib import Path
import hashlib
import json

base = Path('docs/data-sources/evidence')
manifest = json.loads((base / 'manifest.json').read_text())
for capture in manifest['captures']:
    if capture['artifact'] is None:
        continue
    artifact = base / capture['artifact']
    actual = hashlib.sha256(artifact.read_bytes()).hexdigest()
    assert actual == capture['artifact_sha256'], artifact
    json.loads(artifact.read_text())
print('Hashes e sintaxe JSON conferidos.')
PY
```

Essa conferência prova integridade dos artefatos, não semântica ou disponibilidade da fonte. As fichas documentam os recortes; a [auditoria](../verification.md) registra verificações de cobertura, denominadores, lacunas e cálculos feitas nesta entrega. Para reproduzir uma consulta externa, usar a URL exata do manifesto e validar IDs, unidade e período antes de comparar valores.

Não atribuir uma licença única a todos os arquivos. Atribuição e termos identificados estão nas fichas de [IBGE](../ibge.md), [BCB](../bcb.md), [ANP](../anp.md), [Conab/DIEESE](../conab-dieese.md), [FJP](../fjp.md) e [investigações](../../research/phase-4-investigations.md). Dados reais amostrados nesta pasta não substituem a preservação raw exigida para a futura ingestão.
