// GENERATED CODE - DO NOT MODIFY BY HAND
// Regenerate with: flutter pub run build_runner build --delete-conflicting-outputs

part of 'exam_paper_schema.dart';

// **************************************************************************
// IsarCollectionGenerator
// **************************************************************************

// coverage:ignore-file
// ignore_for_file: duplicate_ignore, non_constant_identifier_names, constant_identifier_names, invalid_use_of_protected_member, unnecessary_cast, prefer_const_constructors, lines_longer_than_80_chars, require_trailing_commas, inference_failure_on_function_invocation, unnecessary_parenthesis, unnecessary_raw_strings, unnecessary_null_checks, join_return_with_assignment, prefer_final_locals, avoid_js_rounded_ints, avoid_positional_boolean_parameters, always_specify_types

extension GetExamPaperEntityCollection on Isar {
  IsarCollection<ExamPaperEntity> get examPaperEntitys => this.collection();
}

const ExamPaperEntitySchema = CollectionSchema(
  name: r'ExamPaperEntity',
  id: 7654321098765432101,
  properties: {
    r'board': PropertySchema(
      id: 0,
      name: r'board',
      type: IsarType.string,
    ),
    r'contentJson': PropertySchema(
      id: 1,
      name: r'contentJson',
      type: IsarType.string,
    ),
    r'createdAt': PropertySchema(
      id: 2,
      name: r'createdAt',
      type: IsarType.dateTime,
    ),
    r'gradeLevel': PropertySchema(
      id: 3,
      name: r'gradeLevel',
      type: IsarType.string,
    ),
    r'isSynced': PropertySchema(
      id: 4,
      name: r'isSynced',
      type: IsarType.bool,
    ),
    r'subject': PropertySchema(
      id: 5,
      name: r'subject',
      type: IsarType.string,
    ),
    r'title': PropertySchema(
      id: 6,
      name: r'title',
      type: IsarType.string,
    )
  },
  estimateSize: _examPaperEntityEstimateSize,
  serialize: _examPaperEntitySerialize,
  deserialize: _examPaperEntityDeserialize,
  deserializeProp: _examPaperEntityDeserializeProp,
  idName: r'id',
  indexes: {
    r'title': IndexSchema(
      id: 1234567890123456789,
      name: r'title',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'title',
          type: IndexType.value,
          caseSensitive: true,
        )
      ],
    ),
    r'createdAt': IndexSchema(
      id: -1234567890123456789,
      name: r'createdAt',
      unique: false,
      replace: false,
      properties: [
        IndexPropertySchema(
          name: r'createdAt',
          type: IndexType.value,
          caseSensitive: false,
        )
      ],
    )
  },
  links: {},
  embeddedSchemas: {},
  getId: _examPaperEntityGetId,
  getLinks: _examPaperEntityGetLinks,
  attach: _examPaperEntityAttach,
  version: '3.1.0+1',
);

int _examPaperEntityEstimateSize(
  ExamPaperEntity object,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  var bytesCount = offsets.last;
  bytesCount += 3 + object.board.length * 3;
  bytesCount += 3 + object.contentJson.length * 3;
  bytesCount += 3 + object.gradeLevel.length * 3;
  bytesCount += 3 + object.subject.length * 3;
  bytesCount += 3 + object.title.length * 3;
  return bytesCount;
}

void _examPaperEntitySerialize(
  ExamPaperEntity object,
  IsarWriter writer,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  writer.writeString(offsets[0], object.board);
  writer.writeString(offsets[1], object.contentJson);
  writer.writeDateTime(offsets[2], object.createdAt);
  writer.writeString(offsets[3], object.gradeLevel);
  writer.writeBool(offsets[4], object.isSynced);
  writer.writeString(offsets[5], object.subject);
  writer.writeString(offsets[6], object.title);
}

ExamPaperEntity _examPaperEntityDeserialize(
  Id id,
  IsarReader reader,
  List<int> offsets,
  Map<Type, List<int>> allOffsets,
) {
  final object = ExamPaperEntity();
  object.board = reader.readString(offsets[0]);
  object.contentJson = reader.readString(offsets[1]);
  object.createdAt = reader.readDateTime(offsets[2]);
  object.gradeLevel = reader.readString(offsets[3]);
  object.id = id;
  object.isSynced = reader.readBool(offsets[4]);
  object.subject = reader.readString(offsets[5]);
  object.title = reader.readString(offsets[6]);
  return object;
}

P _examPaperEntityDeserializeProp<P>(
  IsarReader reader,
  int propertyId,
  int offset,
  Map<Type, List<int>> allOffsets,
) {
  switch (propertyId) {
    case 0:
      return (reader.readString(offset)) as P;
    case 1:
      return (reader.readString(offset)) as P;
    case 2:
      return (reader.readDateTime(offset)) as P;
    case 3:
      return (reader.readString(offset)) as P;
    case 4:
      return (reader.readBool(offset)) as P;
    case 5:
      return (reader.readString(offset)) as P;
    case 6:
      return (reader.readString(offset)) as P;
    default:
      throw IsarError('Unknown property with id $propertyId');
  }
}

Id _examPaperEntityGetId(ExamPaperEntity object) {
  return object.id;
}

List<IsarLinkBase<dynamic>> _examPaperEntityGetLinks(ExamPaperEntity object) {
  return [];
}

void _examPaperEntityAttach(
    IsarCollection<dynamic> col, Id id, ExamPaperEntity object) {
  object.id = id;
}

extension ExamPaperEntityQueryWhereSort
    on QueryBuilder<ExamPaperEntity, ExamPaperEntity, QWhere> {
  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterWhere> anyId() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(const IdWhereClause.any());
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterWhere> anyTitle() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'title'),
      );
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterWhere> anyCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        const IndexWhereClause.any(indexName: r'createdAt'),
      );
    });
  }
}

extension ExamPaperEntityQueryWhere
    on QueryBuilder<ExamPaperEntity, ExamPaperEntity, QWhereClause> {
  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterWhereClause> idEqualTo(
      Id id) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: id,
        upper: id,
      ));
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterWhereClause>
      idNotEqualTo(Id id) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(
              IdWhereClause.lessThan(upper: id, includeUpper: false),
            )
            .addWhereClause(
              IdWhereClause.greaterThan(lower: id, includeLower: false),
            );
      } else {
        return query
            .addWhereClause(
              IdWhereClause.greaterThan(lower: id, includeLower: false),
            )
            .addWhereClause(
              IdWhereClause.lessThan(upper: id, includeUpper: false),
            );
      }
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterWhereClause>
      idGreaterThan(Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.greaterThan(lower: id, includeLower: include),
      );
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterWhereClause> idLessThan(
      Id id, {bool include = false}) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(
        IdWhereClause.lessThan(upper: id, includeUpper: include),
      );
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterWhereClause> idBetween(
    Id lowerId,
    Id upperId, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IdWhereClause.between(
        lower: lowerId,
        includeLower: includeLower,
        upper: upperId,
        includeUpper: includeUpper,
      ));
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterWhereClause>
      titleEqualTo(String title) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'title',
        value: [title],
      ));
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterWhereClause>
      titleNotEqualTo(String title) {
    return QueryBuilder.apply(this, (query) {
      if (query.whereSort == Sort.asc) {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'title',
              lower: [],
              upper: [title],
              includeUpper: false,
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'title',
              lower: [title],
              includeLower: false,
              upper: [],
            ));
      } else {
        return query
            .addWhereClause(IndexWhereClause.between(
              indexName: r'title',
              lower: [title],
              includeLower: false,
              upper: [],
            ))
            .addWhereClause(IndexWhereClause.between(
              indexName: r'title',
              lower: [],
              upper: [title],
              includeUpper: false,
            ));
      }
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterWhereClause>
      createdAtEqualTo(DateTime createdAt) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.equalTo(
        indexName: r'createdAt',
        value: [createdAt],
      ));
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterWhereClause>
      createdAtGreaterThan(
    DateTime createdAt, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'createdAt',
        lower: [createdAt],
        includeLower: include,
        upper: [],
      ));
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterWhereClause>
      createdAtLessThan(
    DateTime createdAt, {
    bool include = false,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'createdAt',
        lower: [],
        upper: [createdAt],
        includeUpper: include,
      ));
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterWhereClause>
      createdAtBetween(
    DateTime lowerCreatedAt,
    DateTime upperCreatedAt, {
    bool includeLower = true,
    bool includeUpper = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addWhereClause(IndexWhereClause.between(
        indexName: r'createdAt',
        lower: [lowerCreatedAt],
        includeLower: includeLower,
        upper: [upperCreatedAt],
        includeUpper: includeUpper,
      ));
    });
  }
}

extension ExamPaperEntityQueryFilter
    on QueryBuilder<ExamPaperEntity, ExamPaperEntity, QFilterCondition> {
  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterFilterCondition>
      boardEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'board',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterFilterCondition>
      subjectEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'subject',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterFilterCondition>
      gradeLevelEqualTo(
    String value, {
    bool caseSensitive = true,
  }) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'gradeLevel',
        value: value,
        caseSensitive: caseSensitive,
      ));
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterFilterCondition>
      isSyncedEqualTo(bool value) {
    return QueryBuilder.apply(this, (query) {
      return query.addFilterCondition(FilterCondition.equalTo(
        property: r'isSynced',
        value: value,
      ));
    });
  }
}

extension ExamPaperEntityQuerySortBy
    on QueryBuilder<ExamPaperEntity, ExamPaperEntity, QSortBy> {
  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterSortBy>
      sortByCreatedAt() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.asc);
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterSortBy>
      sortByCreatedAtDesc() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'createdAt', Sort.desc);
    });
  }

  QueryBuilder<ExamPaperEntity, ExamPaperEntity, QAfterSortBy> sortByTitle() {
    return QueryBuilder.apply(this, (query) {
      return query.addSortBy(r'title', Sort.asc);
    });
  }
}

extension ExamPaperEntityQueryObject
    on QueryBuilder<ExamPaperEntity, ExamPaperEntity, QQueryOperations> {}
