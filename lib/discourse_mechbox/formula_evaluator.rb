# frozen_string_literal: true

module DiscourseMechbox
  class FormulaEvaluator
    class Error < StandardError
    end

    NUMBER = :number
    IDENTIFIER = :identifier
    OPERATOR = :operator
    MAX_EXPRESSION_LENGTH = 500

    def initialize(inputs)
      @inputs = inputs.to_h.transform_keys(&:to_s)
    end

    def evaluate(expression)
      raise Error, I18n.t("mechbox.errors.blank_expression") if expression.blank?
      raise Error, I18n.t("mechbox.errors.expression_too_long") if expression.length > MAX_EXPRESSION_LENGTH

      @tokens = tokenize(expression)
      @index = 0
      value = parse_expression

      if current_token
        raise Error, I18n.t("mechbox.errors.unexpected_token", token: current_token[:value])
      end

      value
    end

    private

    def tokenize(expression)
      tokens = []
      index = 0

      while index < expression.length
        match = /\G\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(\*\*|[()+\-*\/]))/.match(
          expression,
          index,
        )

        raise Error, I18n.t("mechbox.errors.invalid_expression") if match.blank?

        if match[1]
          tokens << { type: NUMBER, value: match[1].to_f }
        elsif match[2]
          tokens << { type: IDENTIFIER, value: match[2] }
        else
          tokens << { type: OPERATOR, value: match[3] }
        end

        index = match.end(0)
      end

      tokens
    end

    def parse_expression
      value = parse_term

      while operator?("+") || operator?("-")
        operator = advance[:value]
        right = parse_term
        value = operator == "+" ? value + right : value - right
      end

      value
    end

    def parse_term
      value = parse_power

      while operator?("*") || operator?("/")
        operator = advance[:value]
        right = parse_power
        raise Error, I18n.t("mechbox.errors.division_by_zero") if operator == "/" && right.zero?

        value = operator == "*" ? value * right : value / right
      end

      value
    end

    def parse_power
      value = parse_unary

      if operator?("**")
        advance
        value = value**parse_power
      end

      value
    end

    def parse_unary
      if operator?("+")
        advance
        return parse_unary
      end

      if operator?("-")
        advance
        return -parse_unary
      end

      parse_primary
    end

    def parse_primary
      token = advance
      raise Error, I18n.t("mechbox.errors.invalid_expression") if token.blank?

      return token[:value] if token[:type] == NUMBER
      return variable_value(token[:value]) if token[:type] == IDENTIFIER

      if token[:value] == "("
        value = parse_expression
        raise Error, I18n.t("mechbox.errors.missing_closing_parenthesis") if !operator?(")")

        advance
        return value
      end

      raise Error, I18n.t("mechbox.errors.invalid_expression")
    end

    def variable_value(name)
      if !@inputs.key?(name)
        raise Error, I18n.t("mechbox.errors.unknown_variable", variable: name)
      end

      Float(@inputs[name])
    rescue ArgumentError, TypeError
      raise Error, I18n.t("mechbox.errors.invalid_variable", variable: name)
    end

    def operator?(value)
      current_token&.dig(:type) == OPERATOR && current_token[:value] == value
    end

    def current_token
      @tokens[@index]
    end

    def advance
      token = current_token
      @index += 1
      token
    end
  end
end
