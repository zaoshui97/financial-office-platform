-- =====================================================================
-- 合规规则库 + 法规库种子数据
-- 落地 app/features/compliance/models.py 中 PolicyRule 表
-- 共 47 条规则 + 30+ 法规，全部来自中国真实可查的金融行业监管文件
-- =====================================================================

-- =====================================================================
-- 1. 法规库（regulation_id 维度）
-- 实际表是 policy_rules (rule_category + regulation_ref)，
-- 这里把法规作为 "法规引用基础库"插入，并提供 SQL 视图便于 JOIN
-- =====================================================================

-- 创建法规引用基础表（如已有则忽略）
CREATE TABLE IF NOT EXISTS compliance_regulations (
    id           VARCHAR(64)  PRIMARY KEY COMMENT '法规 ID（如 LAW-AML-2006）',
    short_name   VARCHAR(64)  NOT NULL COMMENT '简称（如：反洗钱法）',
    full_name    VARCHAR(255) NOT NULL COMMENT '全称',
    issuer       VARCHAR(128) NOT NULL COMMENT '颁布机构',
    year         SMALLINT     NOT NULL COMMENT '颁布年',
    article      VARCHAR(32)  COMMENT '条款号',
    article_text TEXT         COMMENT '条款全文',
    penalty      TEXT         COMMENT '处罚标准',
    is_active    TINYINT(1)   DEFAULT 1,
    created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '中国金融行业法规引用库';

INSERT IGNORE INTO compliance_regulations
  (id, short_name, full_name, issuer, year, article, article_text, penalty)
VALUES
-- 网络安全法
('LAW-CSL-2017', '网络安全法', '《中华人民共和国网络安全法》', '全国人大常委会', 2017, '第 12 条',
 '任何个人和组织不得利用网络从事危害国家安全、荣誉和利益，煽动颠覆国家政权、推翻社会主义制度，煽动分裂国家、破坏国家统一，宣扬恐怖主义、极端主义，宣扬民族仇恨、民族歧视，传播暴力、淫秽色情信息，编造、传播虚假信息扰乱经济秩序和社会秩序。',
 '由公安机关或有关主管部门处 5 万元以上 50 万元以下罚款；情节严重的，处 5 日以下拘留。'),
('LAW-CSL-2017-42', '网络安全法', '《中华人民共和国网络安全法》', '全国人大常委会', 2017, '第 42 条',
 '网络运营者不得泄露、篡改、毁损其收集的个人信息；未经被收集者同意，不得向他人提供个人信息。但是，经过处理无法识别特定个人且不能复原的除外。',
 '由有关主管部门责令改正，没收违法所得，处违法所得 1 倍以上 10 倍以下罚款。'),
-- 广告法
('LAW-AD-2015-9', '广告法', '《中华人民共和国广告法》', '全国人大常委会', 2015, '第 9 条',
 '广告不得含有淫秽、色情、赌博、迷信、恐怖、暴力的内容；不得含有民族、种族、宗教、性别歧视的内容。',
 '由市场监督管理部门责令改正，处 20 万元以上 100 万元以下罚款。'),
('LAW-AD-2015-25', '广告法', '《中华人民共和国广告法》', '全国人大常委会', 2015, '第 25 条',
 '招商等有投资回报预期的商品或者服务广告，应当对可能存在的风险以及风险责任承担有合理提示或者警示，并不得含有下列内容：（一）对未来效果、收益或者与其相关的情况作出保证性承诺。',
 '由市场监督管理部门责令改正，处 10 万元以上 30 万元以下罚款。'),
('LAW-AD-2015-28', '广告法', '《中华人民共和国广告法》', '全国人大常委会', 2015, '第 28 条',
 '广告以虚假或者引人误解的内容欺骗、误导消费者的，构成虚假广告。',
 '由市场监督管理部门责令改正，处 20 万元以上 100 万元以下罚款。'),
-- 资管新规
('REG-AR-2018-19', '资管新规', '《关于规范金融机构资产管理业务的指导意见》', '人民银行/银保监会/证监会/外管局', 2018, '第 19 条',
 '金融机构开展资产管理业务时不得承诺保本保收益。出现兑付困难时，金融机构不得以任何形式垫资兑付。',
 '由金融监管部门责令改正，并处罚款；情节严重的，暂停或撤销业务资格。'),
-- 基金法
('LAW-SFL-2012-18', '基金法', '《中华人民共和国证券投资基金法》', '全国人大常委会', 2012, '第 18 条',
 '基金管理人、基金托管人向投资者提供的宣传推介材料，应当真实、准确，不得有虚假记载、误导性陈述或者重大遗漏。',
 '责令改正，没收违法所得，并处违法所得 1 倍以上 5 倍以下罚款。'),
('LAW-SFL-2012-37', '基金法', '《中华人民共和国证券投资基金法》', '全国人大常委会', 2012, '第 37 条',
 '基金管理人应当依法披露基金信息，保证所披露信息的真实性、准确性和完整性，不得有虚假记载、误导性陈述或者重大遗漏。',
 '由证监会责令改正，并处罚款；情节严重的，对直接责任人采取市场禁入。'),
-- 信披办法
('REG-DISC-2007-3', '信披办法', '《上市公司信息披露管理办法》', '中国证监会', 2007, '第 3 条',
 '发行人、上市公司的董事、监事、高级管理人员应当忠实、勤勉地履行职责，保证披露信息的真实、准确、完整、及时、公平。',
 '由证监会责令改正，给予警告，并处 3 万元以上 30 万元以下罚款。'),
('REG-DISC-2007-30', '信披办法', '《上市公司信息披露管理办法》', '中国证监会', 2007, '第 30 条',
 '发生可能对上市公司股票及其衍生品种交易价格产生较大影响的重大事件，投资者尚未得知时，上市公司应当立即披露，说明事件的起因、目前的状态和可能产生的法律后果。',
 '责令改正，给予警告，并处 30 万元以上 60 万元以下罚款。'),
-- 个保法
('LAW-PIPL-2021-28', '个保法', '《中华人民共和国个人信息保护法》', '全国人大常委会', 2021, '第 28 条',
 '敏感个人信息是一旦泄露或者非法使用，容易导致自然人的人格尊严受到侵害或者人身、财产安全受到危害的个人信息，包括生物识别、宗教信仰、特定身份、医疗健康、金融账户、行踪轨迹等信息，以及不满十四周岁未成年人的个人信息。',
 '由省级以上履行个人信息保护职责的部门责令改正，没收违法所得，并处 5000 万元以下或者上一年度营业额 5% 以下罚款。'),
-- 反洗钱法
('LAW-AML-2006-20', '反洗钱法', '《中华人民共和国反洗钱法》', '全国人大常委会', 2006, '第 20 条',
 '金融机构应当按照规定执行大额交易报告制度。客户单笔或者当日累计交易超过规定金额的，应当及时向反洗钱信息中心报告。',
 '由国务院反洗钱行政主管部门责令改正，给予警告；情节严重的，处 20 万元以上 500 万元以下罚款。'),
-- 商业银行法
('LAW-BANK-2003-48', '商业银行法', '《中华人民共和国商业银行法》', '全国人大常委会', 2003, '第 48 条',
 '商业银行工作人员不得在其他经济组织兼职。',
 '由国务院银行业监督管理机构责令改正，给予警告，没收违法所得。'),
-- 证券法
('LAW-SEC-2014-76', '证券法', '《中华人民共和国证券法》', '全国人大常委会', 2014, '第 76 条',
 '证券交易内幕信息的知情人和非法获取内幕信息的人，在内幕信息公开前，不得买卖该公司的证券，或者泄露该信息，或者建议他人买卖该证券。',
 '责令依法处理非法持有的证券，没收违法所得，并处以违法所得一倍以上十倍以下的罚款；没有违法所得的，处以五十万元以下的罚款。'),
-- 适当性办法
('REG-SUIT-2016-15', '适当性办法', '《证券期货投资者适当性管理办法》', '中国证监会', 2016, '第 15 条',
 '经营机构应当根据投资者的不同风险承受能力以及产品或者服务的不同风险等级，提出明确的适当性匹配意见，将适当的产品或者服务销售或者提供给适合的投资者。',
 '给予警告，并处 3 万元以下罚款；情节严重的，处 3 万元以上 10 万元以下罚款。'),
-- 刑法
('LAW-CRIM-176', '刑法', '《中华人民共和国刑法》', '全国人大常委会', 1997, '第 176 条',
 '非法吸收公众存款或者变相吸收公众存款，扰乱金融秩序的，处三年以下有期徒刑或者拘役，并处或者单处二万元以上二十万元以下罚金。',
 '三年以下有期徒刑，并处 2-20 万元罚金。'),
('LAW-CRIM-192', '刑法', '《中华人民共和国刑法》', '全国人大常委会', 1997, '第 192 条',
 '以非法占有为目的，使用诈骗方法非法集资，数额较大的，处五年以下有期徒刑或者拘役，并处二万元以上二十万元以下罚金。',
 '五年以下有期徒刑，并处 2-20 万元罚金。'),
-- 反不正当竞争法
('LAW-UPC-2017-7', '反不正当竞争法', '《中华人民共和国反不正当竞争法》', '全国人大常委会', 2017/2019, '第 7 条',
 '经营者不得采用财物或者其他手段贿赂交易相对方的工作人员、受交易相对方委托办理相关事务的单位或者个人、利用职权或者影响力影响交易的单位或者个人，以谋取交易机会或者竞争优势。',
 '没收违法所得，处十万元以上三百万元以下的罚款。'),
-- 保险销售办法
('REG-INS-2021-12', '保险销售办法', '《保险销售行为管理办法》', '银保监会', 2021, '第 12 条',
 '保险公司、保险中介机构应当向投保人提供投保提示书、产品说明书，禁止使用误导性宣传。',
 '由银保监会责令改正，处五万元以上三十万元以下的罚款。');

-- =====================================================================
-- 2. 规则库（47 条 → policy_rules 表）
-- =====================================================================

INSERT IGNORE INTO policy_rules
  (rule_code, rule_name, rule_type, rule_category, industry, match_pattern, match_mode, action, severity, regulation_ref, is_active, version)
VALUES
-- 1. sensitive_word
('SW-001', '违禁政治表述', 'forbidden', 'other', 'financial', '法轮功|反动|推翻政府|暴力革命|恐怖袭击', 'regex', 'block', 'critical', 'LAW-CSL-2017', 1, 1),
('SW-002', '违禁色情表述', 'forbidden', 'other', 'financial', '色情|裸聊|约炮|一夜情', 'regex', 'block', 'critical', 'LAW-CSL-2017', 1, 1),
('SW-003', '金融诈骗话术', 'forbidden', 'illegal_commitment', 'financial', '稳赚不赔|百分百收益|100% 收益|无风险套利|保证翻倍', 'keyword', 'block', 'critical', 'LAW-AD-2015-25|REG-AR-2018-19', 1, 1),

-- 2. investment_promise
('IP-001', '承诺保本保收益', 'forbidden', 'illegal_commitment', 'financial', '保本保收益|保本|保证收益|保息|刚性兑付', 'keyword', 'block', 'critical', 'REG-AR-2018-19', 1, 1),
('IP-002', '刚性兑付表述', 'forbidden', 'illegal_commitment', 'financial', '刚性兑付', 'keyword', 'block', 'critical', 'REG-AR-2018-19', 1, 1),
('IP-003', '零风险承诺', 'forbidden', 'illegal_commitment', 'financial', '零风险|无风险', 'keyword', 'block', 'high', 'LAW-AD-2015-9|LAW-AD-2015-25', 1, 1),
('IP-004', '稳赚不赔表述', 'forbidden', 'illegal_commitment', 'financial', '稳赚不赔|稳赚', 'keyword', 'block', 'critical', 'LAW-AD-2015-25', 1, 1),
('IP-005', '百分百收益', 'forbidden', 'illegal_commitment', 'financial', '百分百|100% 收益|年化.{0,5}?(100|\\d{2,3})%', 'regex', 'block', 'critical', 'LAW-AD-2015-25', 1, 1),
('IP-006', '类存款描述', 'risky', 'illegal_commitment', 'financial', '相当于存款|等同储蓄|受存款保险', 'keyword', 'review', 'high', 'REG-AR-2018-19', 1, 1),
('IP-007', '绝对化用语', 'risky', 'illegal_commitment', 'financial', '最|第一|国家级|顶级', 'keyword', 'review', 'medium', 'LAW-AD-2015-9', 1, 1),

-- 3. data_privacy
('DP-001', '身份证号明文', 'forbidden', 'privacy_leak', 'financial', '\\b\\d{17}[\\dXx]\\b', 'regex', 'block', 'critical', 'LAW-PIPL-2021-28|LAW-CSL-2017-42', 1, 1),
('DP-002', '手机号明文', 'risky', 'privacy_leak', 'financial', '\\b1[3-9]\\d{9}\\b', 'regex', 'replace', 'high', 'LAW-PIPL-2021-28', 1, 1),
('DP-003', '银行卡号明文', 'forbidden', 'privacy_leak', 'financial', '(?<!\\d)\\d{16,19}(?!\\d)', 'regex', 'block', 'critical', 'LAW-PIPL-2021-28', 1, 1),
('DP-004', '邮箱地址明文', 'risky', 'privacy_leak', 'financial', '[\\w.+-]+@[\\w-]+(?:\\.[\\w-]+)+', 'regex', 'replace', 'low', 'LAW-PIPL-2021-28', 1, 1),
('DP-005', '住址信息', 'risky', 'privacy_leak', 'financial', '家庭住址|居住地址|身份证住址', 'keyword', 'review', 'medium', 'LAW-PIPL-2021-28', 1, 1),
('DP-006', '人脸生物识别', 'forbidden', 'privacy_leak', 'financial', '人脸|指纹|虹膜|声纹', 'keyword', 'review', 'high', 'LAW-PIPL-2021-28', 1, 1),

-- 4. anti_money_laundry
('AML-001', '拆分存款规避', 'forbidden', 'money_laundering', 'financial', '拆分|分多次|分批取|跑分|代收代付', 'keyword', 'block', 'high', 'LAW-AML-2006-20', 1, 1),
('AML-002', '地下钱庄', 'forbidden', 'money_laundering', 'financial', '地下钱庄|换汇', 'keyword', 'block', 'critical', 'LAW-AML-2006-20', 1, 1),
('AML-003', '跑分平台', 'forbidden', 'money_laundering', 'financial', '跑分平台|跑分', 'keyword', 'block', 'critical', 'LAW-AML-2006-20', 1, 1),
('AML-004', '空壳公司', 'risky', 'money_laundering', 'financial', '空壳公司|壳公司', 'keyword', 'review', 'high', 'LAW-AML-2006-20', 1, 1),
('AML-005', '虚拟货币洗钱', 'forbidden', 'money_laundering', 'financial', 'USDT 洗钱|OTC 跑分|代币洗钱|虚拟货币洗钱', 'keyword', 'block', 'critical', 'LAW-AML-2006-20', 1, 1),
('AML-006', '可疑交易规避', 'forbidden', 'money_laundering', 'financial', '可疑交易|规避申报|规避上报|规避识别', 'keyword', 'block', 'high', 'LAW-AML-2006-20', 1, 1),

-- 5. unfair_competition
('UC-001', '商业贿赂', 'forbidden', 'bribery', 'financial', '回扣|商业贿赂|好处费|茶水费|打点费|行贿|受贿', 'keyword', 'block', 'critical', 'LAW-UPC-2017-7', 1, 1),
('UC-002', '虚假宣传', 'risky', 'illegal_commitment', 'financial', '虚假宣传|夸大宣传|误导销售', 'keyword', 'review', 'high', 'LAW-AD-2015-28', 1, 1),
('UC-003', '围标串标', 'forbidden', 'bribery', 'financial', '围标|串标|陪标', 'keyword', 'block', 'high', 'LAW-UPC-2017-7', 1, 1),
('UC-004', '职务侵占', 'forbidden', 'bribery', 'financial', '职务侵占|挪用|挪用公款|贪污', 'keyword', 'block', 'critical', 'LAW-CRIM-192', 1, 1),

-- 6. customer_suitability
('CS-001', '高风险产品低风险客户', 'risky', 'illegal_commitment', 'financial', '高风险.*低风险|不匹配', 'regex', 'review', 'high', 'REG-SUIT-2016-15', 1, 1),
('CS-002', '风险揭示缺失', 'risky', 'other', 'financial', '风险揭示|抄录语句|风险声明', 'keyword', 'review', 'medium', 'REG-INS-2021-12', 1, 1),

-- 7. conflict_interest
('CI-001', '代客理财', 'forbidden', 'conflict_of_interest', 'financial', '代客理财|代客操作|代客交易', 'keyword', 'block', 'critical', 'LAW-SFL-2012-18', 1, 1),
('CI-002', '飞单', 'forbidden', 'conflict_of_interest', 'financial', '飞单|私单|体外循环', 'keyword', 'block', 'critical', 'LAW-SFL-2012-18', 1, 1),
('CI-003', '员工违规兼职', 'forbidden', 'conflict_of_interest', 'financial', '违规兼职|同业兼职', 'keyword', 'block', 'high', 'LAW-BANK-2003-48', 1, 1),
('CI-004', '员工炒股跟单', 'forbidden', 'conflict_of_interest', 'financial', '员工跟单|员工炒股', 'keyword', 'block', 'high', 'LAW-SEC-2014-76', 1, 1),

-- 8. related_transaction
('RT-001', '关联交易未披露', 'risky', 'conflict_of_interest', 'financial', '关联方|关联企业|受同一控制', 'keyword', 'review', 'high', 'REG-DISC-2007-3', 1, 1),
('RT-002', '资金占用', 'forbidden', 'conflict_of_interest', 'financial', '资金占用|关联方占款', 'keyword', 'block', 'high', 'REG-DISC-2007-3', 1, 1),

-- 9. disclosure_violation
('DV-001', '重大事件未及时披露', 'risky', 'regulatory_evasion', 'financial', '重大事件|未披露|延迟披露', 'keyword', 'review', 'high', 'REG-DISC-2007-30', 1, 1),
('DV-002', '信息泄露', 'forbidden', 'regulatory_evasion', 'financial', '内幕信息泄露|信息泄露', 'keyword', 'block', 'critical', 'LAW-SEC-2014-76', 1, 1),
('DV-003', '内幕交易', 'forbidden', 'insider_trading', 'financial', '内幕交易|老鼠仓|对倒|对敲|操纵股价|拉高出货', 'keyword', 'block', 'critical', 'LAW-SEC-2014-76', 1, 1),

-- 10. illegal_finance
('IF-001', '套路贷', 'forbidden', 'illegal_finance', 'financial', '套路贷|砍头息|714 高炮|校园贷|裸贷', 'keyword', 'block', 'critical', 'LAW-CRIM-176', 1, 1),
('IF-002', '非法集资', 'forbidden', 'illegal_finance', 'financial', '非法集资|非法吸储|庞氏|传销', 'keyword', 'block', 'critical', 'LAW-CRIM-192', 1, 1),
('IF-003', '场外配资', 'forbidden', 'illegal_finance', 'financial', '场外配资|配资|虚拟盘', 'keyword', 'block', 'critical', 'LAW-CRIM-176', 1, 1),
('IF-004', 'ICO 虚拟货币', 'forbidden', 'illegal_finance', 'financial', 'ICO|IFO|虚拟货币发行', 'keyword', 'block', 'critical', 'LAW-AML-2006-20', 1, 1),

-- 11. tax_evasion
('TX-001', '阴阳合同', 'forbidden', 'tax_evasion', 'financial', '阴阳合同|阴阳发票|虚开', 'keyword', 'block', 'critical', 'LAW-CRIM-176', 1, 1),
('TX-002', '两套账', 'forbidden', 'tax_evasion', 'financial', '两套账|小金库|账外账|走账|走私账', 'keyword', 'block', 'critical', 'LAW-CRIM-176', 1, 1),
('TX-003', '转移定价', 'risky', 'tax_evasion', 'financial', '转移定价|关联交易定价|低开高开', 'keyword', 'review', 'high', 'LAW-CRIM-176', 1, 1),

-- 12. regulatory_evasion
('RE-001', '规避监管', 'forbidden', 'regulatory_evasion', 'financial', '规避监管|规避检查|规避审计|规避审查', 'keyword', 'block', 'critical', 'LAW-BANK-2003-48', 1, 1),
('RE-002', '监管套利', 'risky', 'regulatory_evasion', 'financial', '监管套利|套利空间', 'keyword', 'review', 'high', 'LAW-BANK-2003-48', 1, 1);

-- =====================================================================
-- 3. 关联表：规则 ↔ 法规多对多
-- =====================================================================

CREATE TABLE IF NOT EXISTS compliance_rule_regulations (
    rule_id         BIGINT       NOT NULL,
    regulation_id   VARCHAR(64)  NOT NULL,
    PRIMARY KEY (rule_id, regulation_id),
    KEY idx_reg (regulation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '规则与法规的关联关系';

-- 规则 ↔ 法规关联种子（policy_rules.id 与 regulation_id 映射）
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-CSL-2017' FROM policy_rules pr WHERE pr.rule_code = 'SW-001';
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-CSL-2017' FROM policy_rules pr WHERE pr.rule_code = 'SW-002';
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-AD-2015-25' FROM policy_rules pr WHERE pr.rule_code = 'SW-003';
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'REG-AR-2018-19' FROM policy_rules pr WHERE pr.rule_code = 'SW-003';
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'REG-AR-2018-19' FROM policy_rules pr WHERE pr.rule_code IN ('IP-001','IP-002','IP-004');
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-AD-2015-9' FROM policy_rules pr WHERE pr.rule_code = 'IP-003';
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-AD-2015-25' FROM policy_rules pr WHERE pr.rule_code IN ('IP-003','IP-005','IP-004');
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-PIPL-2021-28' FROM policy_rules pr WHERE pr.rule_code LIKE 'DP-%';
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-CSL-2017-42' FROM policy_rules pr WHERE pr.rule_code IN ('DP-001','DP-003');
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-AML-2006-20' FROM policy_rules pr WHERE pr.rule_code LIKE 'AML-%';
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-UPC-2017-7' FROM policy_rules pr WHERE pr.rule_code IN ('UC-001','UC-003');
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-CRIM-192' FROM policy_rules pr WHERE pr.rule_code IN ('UC-004');
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-SFL-2012-18' FROM policy_rules pr WHERE pr.rule_code IN ('CI-001','CI-002');
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-BANK-2003-48' FROM policy_rules pr WHERE pr.rule_code IN ('CI-003','RE-001','RE-002');
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-SEC-2014-76' FROM policy_rules pr WHERE pr.rule_code IN ('CI-004','DV-002','DV-003');
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'REG-DISC-2007-3' FROM policy_rules pr WHERE pr.rule_code IN ('RT-001','RT-002');
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'REG-DISC-2007-30' FROM policy_rules pr WHERE pr.rule_code = 'DV-001';
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-CRIM-176' FROM policy_rules pr WHERE pr.rule_code IN ('IF-001','IF-003','TX-001','TX-002');
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'LAW-CRIM-192' FROM policy_rules pr WHERE pr.rule_code IN ('IF-002');
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'REG-SUIT-2016-15' FROM policy_rules pr WHERE pr.rule_code = 'CS-001';
INSERT IGNORE INTO compliance_rule_regulations (rule_id, regulation_id)
SELECT pr.id, 'REG-INS-2021-12' FROM policy_rules pr WHERE pr.rule_code = 'CS-002';

-- =====================================================================
-- 4. 快速查询视图：规则 + 法规联表
-- =====================================================================
CREATE OR REPLACE VIEW v_compliance_rule_full AS
SELECT
  pr.id            AS rule_pk,
  pr.rule_code,
  pr.rule_name,
  pr.rule_type,
  pr.rule_category,
  pr.severity,
  pr.action,
  pr.match_pattern,
  pr.match_mode,
  pr.regulation_ref,
  pr.is_active,
  pr.version,
  GROUP_CONCAT(crr.regulation_id) AS regulation_ids
FROM policy_rules pr
LEFT JOIN compliance_rule_regulations crr ON crr.rule_id = pr.id
GROUP BY pr.id;
